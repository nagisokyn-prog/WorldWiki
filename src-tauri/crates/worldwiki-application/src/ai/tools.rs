use std::sync::Arc;
use serde_json::Value;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use crate::errors::ApplicationError;
use crate::manuscript::ManuscriptServices;
use crate::knowledge::KnowledgeServices;
use crate::calendar::CalendarServices;
use crate::plot::PlotServices;
use crate::workflows::{EditManuscriptAtomicWorkflow, EditManuscriptRequest, EditManuscriptResult, HybridSemanticSearchWorkflow};
use crate::common::JobManager;

/// Очищает ID от кавычек, скобок SurrealDB и гарантирует правильный префикс таблицы
pub fn clean_record_id(default_table: &str, raw: &str) -> String {
    let trimmed = raw.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
    if trimmed.is_empty() {
        return String::new();
    }
    if let Some((tbl, id_part)) = trimmed.split_once(':') {
        let clean_id = id_part.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
        format!("{}:{}", tbl.trim(), clean_id)
    } else {
        format!("{}:{}", default_table, trimmed)
    }
}

pub struct AiToolFacades {
    pub manuscript: Arc<ManuscriptServices>,
    pub knowledge: Arc<KnowledgeServices>,
    pub calendar: Arc<CalendarServices>,
    pub plot: Arc<PlotServices>,
    pub edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
    pub search_workflow: Arc<HybridSemanticSearchWorkflow>,
    pub job_manager: Arc<JobManager>,
}

impl AiToolFacades {
    pub fn new(
        manuscript: Arc<ManuscriptServices>,
        knowledge: Arc<KnowledgeServices>,
        calendar: Arc<CalendarServices>,
        plot: Arc<PlotServices>,
        edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
        search_workflow: Arc<HybridSemanticSearchWorkflow>,
        job_manager: Arc<JobManager>,
    ) -> Self {
        Self {
            manuscript,
            knowledge,
            calendar,
            plot,
            edit_workflow,
            search_workflow,
            job_manager,
        }
    }

    /// 1. 🔍 query_world
    pub async fn query_world(&self, project_id: &str, query: &str, scope: &str, top_k: usize) -> Result<Vec<Value>, ApplicationError> {
        self.search_workflow.search(project_id, query, scope, top_k).await
    }

    /// 2. 🧙‍♂️ inspect_entity with Smart Resolution & Self-Healing
    pub async fn inspect_entity(&self, project_id: &str, entity_id_or_query: &str) -> Result<Value, ApplicationError> {
        let query = entity_id_or_query.trim();
        if query.is_empty() {
            return Ok(serde_json::json!({
                "error": "entity_id or name cannot be empty",
                "hint": "Provide an entity_id or name, or use query_world to search entities."
            }));
        }

        // 1. Try exact raw id first
        if let Ok(card) = self.knowledge.get_full_card(query).await {
            return Ok(serde_json::to_value(card).unwrap_or_default());
        }

        // 2. Try cleaned id with "entities:" prefix
        let cleaned_id = clean_record_id("entities", query);
        if cleaned_id != query {
            if let Ok(card) = self.knowledge.get_full_card(&cleaned_id).await {
                return Ok(serde_json::to_value(card).unwrap_or_default());
            }
        }

        // Fallback: search by name/query in the project
        let search_res = self.knowledge.entity_repo.search(project_id, query, 5).await
            .unwrap_or_default();

        if search_res.is_empty() {
            Ok(serde_json::json!({
                "error": format!("Entity '{}' not found in project", query),
                "hint": "Use query_world to search the knowledge base for relevant entities."
            }))
        } else if search_res.len() == 1 || search_res.iter().any(|e| e.name.eq_ignore_ascii_case(query)) {
            let exact_match = search_res.iter().find(|e| e.name.eq_ignore_ascii_case(query)).unwrap_or(&search_res[0]);
            let card = self.knowledge.get_full_card(&exact_match.id).await?;
            Ok(serde_json::to_value(card).unwrap_or_default())
        } else {
            let candidates: Vec<Value> = search_res.into_iter().map(|e| serde_json::json!({
                "id": e.id,
                "name": e.name,
                "description": e.description
            })).collect();
            Ok(serde_json::json!({
                "status": "disambiguation_needed",
                "message": format!("Entity '{}' matched multiple candidates in project", query),
                "candidates": candidates,
                "hint": "Please call inspect_entity with the exact id from candidates."
            }))
        }
    }

    /// 3. ✍️ manage_entity
    pub async fn manage_entity(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        match action {
            "create" | "update" => {
                let mut obj = match payload {
                    Value::Object(map) => map,
                    _ => return Err(ApplicationError::Validation("Expected object payload for entity".into())),
                };

                // 1. Determine entity ID (auto-generate safe unique ID if omitted or custom)
                let raw_id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let is_safe_ascii = !raw_id.is_empty() && raw_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ':');
                let entity_id = if raw_id.is_empty() || !is_safe_ascii {
                    format!("entities:char_{}", uuid::Uuid::new_v4().simple())
                } else if !raw_id.starts_with("entities:") {
                    format!("entities:{raw_id}")
                } else {
                    raw_id.to_string()
                };

                // 2. Extract or determine Project ID
                let project_id = obj
                    .get("project_id")
                    .or_else(|| obj.get("projectId"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // 3. Extract or determine Type Key (character, location, organization, item, etc.)
                let type_key = obj
                    .get("type_key")
                    .or_else(|| obj.get("entity_type"))
                    .or_else(|| obj.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("character")
                    .to_string();

                // 4. Extract Name with high forgiveness (first input)
                let mut name = obj
                    .get("name")
                    .or_else(|| obj.get("название"))
                    .or_else(|| obj.get("title"))
                    .or_else(|| obj.get("label"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();

                let description = obj
                    .get("description")
                    .or_else(|| obj.get("описание"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let tags: Vec<String> = obj
                    .get("tags")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                // 5. Build Attributes map
                let mut attributes_map = match obj.remove("attributes") {
                    Some(Value::Object(m)) => m,
                    _ => serde_json::Map::new(),
                };

                // If name was inside attributes_map["название"]
                if name.is_empty() {
                    if let Some(n) = attributes_map.get("название").and_then(|v| v.as_str()) {
                        name = n.trim().to_string();
                    }
                }

                if name.is_empty() {
                    name = "Новая сущность".to_string();
                }

                // Ensure attributes["название"] matches entity.name
                attributes_map.insert("название".to_string(), Value::String(name.clone()));
                if let Some(ref d) = description {
                    attributes_map.insert("описание".to_string(), Value::String(d.clone()));
                }

                // Collect any other root fields into attributes (e.g. "пол", "статус", "роль_в_истории")
                for (k, v) in obj {
                    if !["id", "project_id", "projectId", "type_key", "entity_type", "type", "name", "tags", "created_at", "updated_at", "description", "описание"].contains(&k.as_str()) {
                        attributes_map.insert(k, v);
                    }
                }

                let entity = Entity {
                    id: entity_id.clone(),
                    project_id,
                    type_key: type_key.clone(),
                    name: name.clone(),
                    description,
                    attributes: Value::Object(attributes_map),
                    tags,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };

                self.knowledge.save_entity(&entity).await?;

                // Emit event for UI synchronization without F5 (Bug #9)
                let _ = self.knowledge.events.publish_raw(
                    "ww-entity-saved",
                    serde_json::json!({
                        "type": entity.type_key,
                        "id": entity.id
                    })
                ).await;

                Ok(serde_json::json!({
                    "status": "success",
                    "entity_id": entity.id,
                    "name": entity.name,
                    "type_key": entity.type_key
                }))
            }
            "relate" => {
                let rel: EntityRelation = serde_json::from_value(payload)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                self.knowledge.add_relation(&rel).await?;
                Ok(serde_json::json!({ "status": "success", "relation_id": rel.id }))
            }
            "delete" => {
                let entity_id = if let Some(s) = payload.as_str() {
                    s.to_string()
                } else if let Some(id) = payload.get("entity_id").or_else(|| payload.get("id")).and_then(|v| v.as_str()) {
                    id.to_string()
                } else {
                    return Err(ApplicationError::Validation("Expected entity_id string or object with entity_id".into()));
                };
                self.knowledge.entity_repo.delete(&entity_id).await?;
                Ok(serde_json::json!({ "status": "success", "deleted_id": entity_id }))
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported action: {action}"))),
        }
    }

    /// 4. 📖 read_manuscript with Smart Resolution (by ID, order/number, title, or list all)
    pub async fn read_manuscript(&self, project_id: &str, chapter_id_or_query: &str) -> Result<Value, ApplicationError> {
        let query = chapter_id_or_query.trim();
        let chapters = self.manuscript.repo.list_by_project(project_id).await
            .map_err(ApplicationError::Domain)?;

        if query.is_empty() {
            let list: Vec<Value> = chapters.into_iter().map(|c| serde_json::json!({
                "id": c.id,
                "title": c.title,
                "word_count": c.word_count
            })).collect();
            return Ok(serde_json::json!({
                "chapters": list,
                "count": list.len(),
                "hint": "Select a chapter using its id to read its full content."
            }));
        }

        // 1. Try exact raw id first
        if let Ok(ch) = self.manuscript.get_chapter(query).await {
            return Ok(serde_json::to_value(ch).unwrap_or_default());
        }

        // 2. Try cleaned id with "chapters:" prefix
        let cleaned_id = clean_record_id("chapters", query);
        if cleaned_id != query {
            if let Ok(ch) = self.manuscript.get_chapter(&cleaned_id).await {
                return Ok(serde_json::to_value(ch).unwrap_or_default());
            }
        }

        // Fallback 1: Integer index / chapter number (e.g. "1", 1)
        if let Ok(order) = query.parse::<usize>() {
            if order >= 1 && order <= chapters.len() {
                let ch = &chapters[order - 1];
                return Ok(serde_json::to_value(ch).unwrap_or_default());
            }
        }

        // Fallback 2: Title search (case-insensitive substring or exact match)
        let q_lower = query.to_lowercase();
        if let Some(ch) = chapters.iter().find(|c| c.title.to_lowercase() == q_lower || c.title.to_lowercase().contains(&q_lower) || c.id.to_lowercase().contains(&q_lower)) {
            return Ok(serde_json::to_value(ch).unwrap_or_default());
        }

        let available: Vec<Value> = chapters.into_iter().map(|c| serde_json::json!({
            "id": c.id,
            "title": c.title
        })).collect();

        Ok(serde_json::json!({
            "error": format!("Chapter '{}' not found in project", query),
            "available_chapters": available,
            "hint": "Please choose a chapter from available_chapters using its exact id."
        }))
    }

    /// 5. 📝 edit_manuscript
    pub async fn edit_manuscript(&self, req: EditManuscriptRequest) -> Result<EditManuscriptResult, ApplicationError> {
        self.edit_workflow.execute(req).await
    }

    /// 6. ⏳ chronology / timeline_manager
    pub async fn chronology(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        self.timeline_manager(action, payload).await
    }

    pub async fn timeline_manager(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        match action {
            "convert_absolute" => {
                let minute = payload["minute"].as_i64().unwrap_or(0);
                let cal_val = &payload["calendar"];
                let cal = serde_json::from_value(cal_val.clone())
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let era_index = payload["era_index"].as_u64().unwrap_or(0) as usize;
                self.calendar.convert_absolute_to_local(minute, &cal, era_index)
            }
            "convert_date" => {
                let from_cal = serde_json::from_value(payload["from_calendar"].clone())
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let to_cal = serde_json::from_value(payload["to_calendar"].clone())
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let era_index = payload["era_index"].as_u64().unwrap_or(0) as usize;
                let year = payload["year"].as_i64().unwrap_or(1) as i32;
                let month = payload["month"].as_i64().unwrap_or(1) as i32;
                let day = payload["day"].as_i64().unwrap_or(1) as i32;
                let hour = payload["hour"].as_i64().unwrap_or(0) as i32;
                let minute = payload["minute"].as_i64().unwrap_or(0) as i32;
                let target_era = payload["target_era_index"].as_u64().map(|v| v as usize);
                self.calendar.convert_calendar_date(
                    &from_cal,
                    &to_cal,
                    None,
                    era_index,
                    year,
                    month,
                    day,
                    hour,
                    minute,
                    target_era,
                )
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported timeline action: {action}"))),
        }
    }

    /// 7. 🛡️ audit_consistency
    pub async fn audit_consistency(&self, target_type: &str, target_id: &str) -> Result<Value, ApplicationError> {
        match target_type {
            "volume" => {
                let report = self.plot.audit_volume(target_id).await?;
                Ok(serde_json::to_value(report).unwrap_or_default())
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported audit target: {target_type}"))),
        }
    }

    /// 8. 🤖 delegate_task (Read-Only Subagent Orchestration & Runtime)
    pub async fn delegate_task(&self, task_id: &str, prompt: &str) -> Result<Value, ApplicationError> {
        let token = self.job_manager.create_job(task_id).await;
        token.check()?;

        println!("[SUBAGENT] Spawning subagent task_id={} with prompt='{}'", task_id, prompt);
        
        let query_res = self.query_world("", prompt, "all", 6).await.unwrap_or_default();
        
        let mut findings = Vec::new();
        for item in query_res {
            let st = item.get("source_type").and_then(|s| s.as_str()).unwrap_or("");
            if st == "entity" {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    findings.push(format!("Сущность '{}': {:?}", name, item.get("attributes").unwrap_or(&serde_json::Value::Null)));
                }
            } else if st == "chapter" {
                if let Some(title) = item.get("title").and_then(|t| t.as_str()) {
                    let preview = item.get("content").and_then(|c| c.as_str()).unwrap_or("").chars().take(200).collect::<String>();
                    findings.push(format!("Глава '{}': {}...", title, preview));
                }
            } else if let Some(content) = item.get("content").and_then(|c| c.as_str()) {
                findings.push(content.to_string());
            }
        }

        let summary = if findings.is_empty() {
            format!("Саб-агент исследовал материалы по задаче '{}'. Прямых совпадений в базе знаний не обнаружено.", prompt)
        } else {
            format!("Саб-агент завершил исследование по задаче '{}'. Найдено {} фактов/источников:\n{}", prompt, findings.len(), findings.join("\n\n"))
        };

        Ok(serde_json::json!({
            "task_id": task_id,
            "status": "completed",
            "prompt": prompt,
            "summary": summary,
            "findings_count": findings.len(),
            "capabilities": ["query_world", "read_manuscript", "inspect_entity", "chronology", "audit_consistency"]
        }))
    }

    /// Возвращает канонические JSON-схемы инструментов с фильтрацией по режимам (companion, editor, analyst)
    pub fn tool_definitions_for_mode(mode: &str) -> Vec<Value> {
        let world_query_def = serde_json::json!({
            "name": "world_query",
            "description": "Гибридный семантический и лексический поиск (BM25 + эмбеддинги + граф связей) по базе знаний мира, сущностям и главам рукописи.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Поисковый запрос фактов, информации или сущностей" },
                    "scope": { "type": "string", "enum": ["all", "entities", "chapters"], "description": "Область поиска: 'all' (всё), 'entities' (энциклопедия), 'chapters' (рукопись)", "default": "all" },
                    "top_k": { "type": "integer", "description": "Количество результатов", "default": 8 }
                },
                "required": ["query"]
            }
        });

        let entity_inspect_def = serde_json::json!({
            "name": "entity_inspect",
            "description": "Получить полную анкету сущности по ID ('entities:char_123') ИЛИ по имени/псевдониму персонажа/локации (например, 'Катя', 'Замок'). Автоматически извлекает карточку, свойства и граф связей.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "entity_id_or_name": { "type": "string", "description": "ID сущности (например, 'entities:char_123') ИЛИ точное/примерное имя персонажа/локации." },
                    "entity_id": { "type": "string", "description": "Алиас для entity_id_or_name (обратная совместимость)." }
                }
            }
        });

        let manuscript_read_def = serde_json::json!({
            "name": "manuscript_read",
            "description": "Прочитать текст главы рукописи по chapter_id/номеру/названию, либо получить оглавление (chapter_id: 'list').",
            "input_schema": {
                "type": "object",
                "properties": {
                    "chapter_id": { "type": "string", "description": "ID главы (например, 'chapters:ch1'), номер (например, '1') или 'list' для оглавления" }
                },
                "required": ["chapter_id"]
            }
        });

        let timeline_manage_def = serde_json::json!({
            "name": "timeline_manage",
            "description": "Расчет хронологии, конвертация календарных дат и вычисление абсолютной минуты (M_abs).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["convert_absolute", "convert_date"] },
                    "payload": { "type": "object", "description": "Параметры конвертации даты или календаря" }
                },
                "required": ["action", "payload"]
            }
        });

        let entity_manage_def = serde_json::json!({
            "name": "entity_manage",
            "description": "Создать, обновить или удалить сущность в энциклопедии мира, либо добавить связь. Для создания передайте action: 'create' и объект свойств (name, type_key, description, attributes). Поля id и project_id указывать НЕ нужно — они формируются автоматически.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["create", "update", "delete", "relate"], "description": "Действие над сущностью" },
                    "payload": {
                        "type": "object",
                        "description": "Бланк сущности. Для create: 'name' (обязательно), 'type_key' ('character', 'location', 'faction', 'item'), 'description', 'attributes'."
                    }
                },
                "required": ["action", "payload"]
            }
        });

        let manuscript_edit_def = serde_json::json!({
            "name": "manuscript_edit",
            "description": "Атомарное точечное внесение правок в рукопись с поддержкой отката и сохранением маркеров ((Сущностей)).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "chapter_id": { "type": "string", "description": "ID главы" },
                    "operation_id": { "type": "string", "description": "Уникальный ID операции (например, uuid)" },
                    "patch": { "type": "object", "description": "Минимальный патч изменений" }
                },
                "required": ["chapter_id", "operation_id"]
            }
        });

        let consistency_audit_def = serde_json::json!({
            "name": "consistency_audit",
            "description": "Комплексный аудит сюжета тома: проверка неразрешенных сюжетных обещаний (чеховских ружей), зависших веток и противоречий.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "target_type": { "type": "string", "enum": ["volume"] },
                    "target_id": { "type": "string", "description": "ID тома (например, 'volumes:vol_1')" }
                },
                "required": ["target_type", "target_id"]
            }
        });

        let task_delegate_def = serde_json::json!({
            "name": "task_delegate",
            "description": "Делегировать тяжелое независимое исследование фоновому Read-Only субагенту.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string", "description": "ID задачи" },
                    "prompt": { "type": "string", "description": "Подробная инструкция для субагента (цель, скоуп, ограничения)" }
                },
                "required": ["task_id", "prompt"]
            }
        });

        match mode {
            "editor" => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                entity_manage_def,
                manuscript_edit_def,
                timeline_manage_def,
            ],
            "analyst" => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                timeline_manage_def,
                consistency_audit_def,
                task_delegate_def,
            ],
            _ => vec![
                world_query_def,
                entity_inspect_def,
                manuscript_read_def,
                timeline_manage_def,
            ], // companion (read-only)
        }
    }

    /// Обратная совместимость для получения всех определений
    pub fn tool_definitions() -> Vec<Value> {
        Self::tool_definitions_for_mode("editor")
    }
}
