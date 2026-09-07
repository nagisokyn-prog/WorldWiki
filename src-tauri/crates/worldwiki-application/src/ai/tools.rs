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
                let entity: Entity = serde_json::from_value(payload)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                self.knowledge.save_entity(&entity).await?;
                Ok(serde_json::json!({ "status": "success", "entity_id": entity.id }))
            }
            "relate" => {
                let rel: EntityRelation = serde_json::from_value(payload)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                self.knowledge.add_relation(&rel).await?;
                Ok(serde_json::json!({ "status": "success", "relation_id": rel.id }))
            }
            "delete" => {
                let entity_id = payload.as_str().ok_or_else(|| ApplicationError::Validation("Expected entity_id string".into()))?;
                self.knowledge.entity_repo.delete(entity_id).await?;
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
        Ok(serde_json::json!({
            "task_id": task_id,
            "status": "spawned_read_only",
            "prompt": prompt,
            "capabilities": ["query_world", "read_manuscript", "inspect_entity", "chronology", "audit_consistency"]
        }))
    }

    /// Возвращает канонические JSON-схемы инструментов для языковой модели
    pub fn tool_definitions() -> Vec<Value> {
        vec![
            serde_json::json!({
                "name": "query_world",
                "description": "Гибридный семантический поиск (BM25 + HNSW + граф связей) по базе знаний мира, сущностям и главам рукописи.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "project_id": { "type": "string", "description": "Идентификатор проекта (например, 'default')" },
                        "query": { "type": "string", "description": "Поисковый запрос фактов или сущностей" },
                        "scope": { "type": "string", "description": "Область поиска: 'all', 'entities', 'chapters'", "default": "all" },
                        "top_k": { "type": "integer", "description": "Количество результатов", "default": 8 }
                    },
                    "required": ["query"]
                }
            }),
            serde_json::json!({
                "name": "inspect_entity",
                "description": "Получить полную анкету сущности по ID (с динамическими полями и графом связей).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "entity_id": { "type": "string", "description": "ID сущности (например, 'entities:hero')" }
                    },
                    "required": ["entity_id"]
                }
            }),
            serde_json::json!({
                "name": "manage_entity",
                "description": "Создать/обновить/удалить сущность или добавить связь (create, update, delete, relate).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "action": { "type": "string", "enum": ["create", "update", "delete", "relate"] },
                        "payload": { "type": "object", "description": "Данные сущности или связи" }
                    },
                    "required": ["action", "payload"]
                }
            }),
            serde_json::json!({
                "name": "read_manuscript",
                "description": "Прочитать текст главы рукописи по chapter_id, либо получить оглавление (chapter_id: 'list').",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chapter_id": { "type": "string", "description": "ID главы (например, 'chapters:ch1') или 'list' для оглавления" }
                    },
                    "required": ["chapter_id"]
                }
            }),
            serde_json::json!({
                "name": "edit_manuscript",
                "description": "Атомарное внесение правок в рукопись с поддержкой отката и парсингом ((Сущностей)).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "chapter_id": { "type": "string", "description": "ID главы" },
                        "operation_id": { "type": "string", "description": "Уникальный ID операции" },
                        "patch": { "type": "object", "description": "Патч изменений" }
                    },
                    "required": ["chapter_id", "operation_id"]
                }
            }),
            serde_json::json!({
                "name": "chronology",
                "description": "Расчет хронологии, конвертация календарных дат и расчет абсолютной минуты (M_abs).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "action": { "type": "string", "enum": ["convert_absolute", "convert_date"] },
                        "payload": { "type": "object", "description": "Параметры конвертации даты или календаря" }
                    },
                    "required": ["action", "payload"]
                }
            }),
            serde_json::json!({
                "name": "audit_consistency",
                "description": "Комплексный аудит сюжета тома: проверка неразрешенных сюжетных обещаний (чеховских ружей) и противоречий.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "target_type": { "type": "string", "enum": ["volume"] },
                        "target_id": { "type": "string", "description": "ID тома (например, 'volumes:vol1')" }
                    },
                    "required": ["target_type", "target_id"]
                }
            }),
            serde_json::json!({
                "name": "delegate_task",
                "description": "Делегировать тяжелое исследование фоновому Read-Only субагенту.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string", "description": "ID задачи" },
                        "prompt": { "type": "string", "description": "Инструкция для субагента" }
                    },
                    "required": ["task_id", "prompt"]
                }
            }),
        ]
    }
}
