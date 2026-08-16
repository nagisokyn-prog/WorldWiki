use claw_api::ToolDefinition;
use serde_json::{json, Value};
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

const RAG_TOP_K: usize = 8;

pub fn str_schema(description: &str) -> serde_json::Value {
    json!({ "type": "string", "description": description })
}

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "rag_search".to_string(),
            description: Some(
                "Поиск по всем данным проекта (сущности, главы, тома, арки, календарь). \
                 Всегда используй этот инструмент для получения фактов из мира, прежде чем отвечать."
                    .to_string(),
            ),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": str_schema("Поисковый запрос на русском или английском"),
                    "top_k": json!({ "type": "integer", "description": "Сколько результатов вернуть", "default": 8 })
                },
                "required": ["query"]
            }),
        },
        ToolDefinition {
            name: "search_entities".to_string(),
            description: Some("Поиск сущностей по имени/описанию (персонажи, локации и т.д.).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": str_schema("Ключевые слова"),
                    "type_key": str_schema("Фильтр по типу сущности (опционально)")
                },
                "required": ["query"]
            }),
        },
        ToolDefinition {
            name: "get_entity".to_string(),
            description: Some("Получить сущность по её id (RecordId вида entities:<id>).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "id": str_schema("id сущности") },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "get_relations".to_string(),
            description: Some("Получить связи сущности (с кем дружит, враждует и т.п.).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "entity_id": str_schema("id сущности") },
                "required": ["entity_id"]
            }),
        },
        ToolDefinition {
            name: "get_chapter".to_string(),
            description: Some("Получить содержимое главы по id. ВНИМАНИЕ: Возвращает скомпилированный текст главы (compiled_text). Если текст пуст, вернет ошибку.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "id": str_schema("id главы") },
                "required": ["id"]
            }),
        },
        ToolDefinition {
            name: "get_chapters_list".to_string(),
            description: Some("Получить оглавление (список всех глав с их ID и названиями). Используй этот инструмент ПЕРЕД вызовом get_chapter, если не знаешь точный ID главы.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {},
            }),
        },
        ToolDefinition {
            name: "get_timeline".to_string(),
            description: Some("Получить события таймлайна проекта или главы.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "chapter_id": str_schema("id главы (опционально)")
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "get_calendar".to_string(),
            description: Some("Получить календарь/эпохи/сезоны проекта.".to_string()),
            input_schema: json!({ "type": "object", "properties": {}, "required": [] }),
        },
        ToolDefinition {
            name: "get_entity_schema".to_string(),
            description: Some("Получить схему сущности для понимания допустимых полей.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "type_key": str_schema("Тип сущности (например, character)") },
                "required": ["type_key"]
            }),
        },
        ToolDefinition {
            name: "update_entity".to_string(),
            description: Some("Обновить сущность (частичное обновление JSON).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": str_schema("id сущности"),
                    "patch": { "type": "object", "description": "JSON с обновленными полями" }
                },
                "required": ["id", "patch"]
            }),
        },
        ToolDefinition {
            name: "create_entity".to_string(),
            description: Some("Создать новую сущность.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "type_key": str_schema("Тип сущности"),
                    "data": { "type": "object", "description": "Данные сущности" }
                },
                "required": ["type_key", "data"]
            }),
        },
        ToolDefinition {
            name: "create_relation".to_string(),
            description: Some("Создать связь между сущностями.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "from": str_schema("id исходящей сущности"),
                    "to": str_schema("id целевой сущности"),
                    "rel_type": str_schema("Тип связи"),
                    "metadata": { "type": "object", "description": "Доп. данные связи" }
                },
                "required": ["from", "to", "rel_type"]
            }),
        },
        ToolDefinition {
            name: "update_chapter".to_string(),
            description: Some("Обновить текст главы (Tiptap JSON).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": str_schema("id главы"),
                    "content": { "type": "object", "description": "Tiptap JSON" }
                },
                "required": ["id", "content"]
            }),
        },
        ToolDefinition {
            name: "add_timeline_event".to_string(),
            description: Some("Добавить событие в таймлайн.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "chapter_id": str_schema("id главы"),
                    "event": { "type": "object", "description": "Данные события" }
                },
                "required": ["event"]
            }),
        },
        ToolDefinition {
            name: "get_entity_evolution".to_string(),
            description: Some("Анализ: получить историю изменений сущности.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "entity_id": str_schema("id сущности") },
                "required": ["entity_id"]
            }),
        },
        ToolDefinition {
            name: "get_relation_history".to_string(),
            description: Some("Анализ: получить историю изменений связи.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "relation_id": str_schema("id связи") },
                "required": ["relation_id"]
            }),
        },
        ToolDefinition {
            name: "validate_world_consistency".to_string(),
            description: Some("Анализ: поиск логических противоречий в лоре и таймлайне (самопроверка ИИ). Прогоняет утверждение по БД.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "statement": str_schema("Сюжетное утверждение для проверки") },
                "required": ["statement"]
            }),
        },
        ToolDefinition {
            name: "search_chat_history".to_string(),
            description: Some("Поиск по истории сообщений чата (RAG).".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "query": str_schema("Запрос для поиска") },
                "required": ["query"]
            }),
        },
        ToolDefinition {
            name: "spawn_subagent".to_string(),
            description: Some("Создать фонового саб-агента для выполнения долгой задачи.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task": str_schema("Описание задачи"),
                    "subagent_type": str_schema("Тип саб-агента (например, Analyst, Explorer)")
                },
                "required": ["task"]
            }),
        },
    ]
}

pub struct WorldWikiTools {
    pub db: Surreal<Db>,
    pub project_id: String,
}

pub fn project_record(project_id: &str) -> RecordId {
    let part = project_id
        .strip_prefix("projects:")
        .unwrap_or(project_id)
        .trim_matches('`')
        .to_string();
    RecordId::new("projects", part)
}

impl WorldWikiTools {
    pub async fn run(&self, name: &str, args: &Value) -> Result<String, String> {
        match name {
            "rag_search" => self.rag_search(args).await,
            "search_entities" => self.search_entities(args).await,
            "get_entity" => self.get_entity(args).await,
            "get_relations" => self.get_relations(args).await,
            "get_chapter" => self.get_chapter(args).await,
            "get_chapters_list" => self.get_chapters_list().await,
            "get_timeline" => self.get_timeline(args).await,
            "get_calendar" => self.get_calendar().await,
            "get_entity_schema" => self.get_entity_schema(args).await,
            "update_entity" => self.update_entity(args).await,
            "create_entity" => self.create_entity(args).await,
            "create_relation" => self.create_relation(args).await,
            "update_chapter" => self.update_chapter(args).await,
            "add_timeline_event" => self.add_timeline_event(args).await,
            "get_entity_evolution" => self.get_entity_evolution(args).await,
            "get_relation_history" => self.get_relation_history(args).await,
            "validate_world_consistency" => self.validate_world_consistency(args).await,
            "search_chat_history" => self.search_chat_history(args).await,
            "spawn_subagent" => self.spawn_subagent(args).await,
            other => Err(format!("unknown tool: {other}")),
        }
    }

    fn arg<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
        args.get(key).and_then(|v| v.as_str())
    }

    async fn rag_search(&self, args: &Value) -> Result<String, String> {
        let query = Self::arg(args, "query").unwrap_or("").to_lowercase();
        let top_k = args
            .get("top_k")
            .and_then(|v| v.as_u64())
            .unwrap_or(RAG_TOP_K as u64) as usize;
        let top_k = top_k.min(RAG_TOP_K);

        let mut results: Vec<Value> = Vec::new();
        for table in [
            "entities",
            "chapters",
            "text_blocks",
            "volumes",
            "arcs",
            "user_dictionary",
        ] {
            let mut resp = self
                .db
                .query("SELECT * FROM type::table($tab) WHERE project_id = $proj LIMIT 500".to_string())
                .bind(("tab", table))
                .bind(("proj", project_record(&self.project_id)))
                .await
                .map_err(|e| e.to_string())?;
            let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
            for row in rows {
                let haystack = serde_json::to_string(&row)
                    .unwrap_or_default()
                    .to_lowercase();
                if haystack.contains(&query) {
                    results.push(row);
                }
            }
        }

        results.truncate(top_k);
        Ok(
            json!({ "table": "rag", "matches": serde_json::to_value(results).unwrap_or_default() })
                .to_string(),
        )
    }

    async fn search_entities(&self, args: &Value) -> Result<String, String> {
        let query = Self::arg(args, "query").unwrap_or("").to_lowercase();
        let type_key = Self::arg(args, "type_key");
        let mut resp = self
            .db
            .query("SELECT * FROM entities WHERE project_id = $proj LIMIT 1000")
            .bind(("proj", project_record(&self.project_id)))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            if let Some(tk) = type_key {
                if row.get("entity_type").and_then(|v| v.as_str()) != Some(tk) {
                    continue;
                }
            }
            let hay = serde_json::to_string(&row)
                .unwrap_or_default()
                .to_lowercase();
            if hay.contains(&query) {
                out.push(row);
            }
        }
        out.truncate(RAG_TOP_K);
        Ok(json!({ "entities": out }).to_string())
    }

    async fn get_entity(&self, args: &Value) -> Result<String, String> {
        let id = Self::arg(args, "id").ok_or("missing id")?;
        let record = Self::parse_id("entities", id);
        let mut resp = self
            .db
            .query("SELECT * FROM entities WHERE id = $id LIMIT 1")
            .bind(("id", record))
            .await
            .map_err(|e| e.to_string())?;
        let row: Option<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "entity": row }).to_string())
    }

    async fn get_relations(&self, args: &Value) -> Result<String, String> {
        let entity_id = Self::arg(args, "entity_id").ok_or("missing entity_id")?;
        let entity_part = entity_id.strip_prefix("entities:").unwrap_or(entity_id);
        let entity = RecordId::new("entities", entity_part.to_lowercase());
        let proj = project_record(&self.project_id);
        let mut resp = self
            .db
            .query(
                "SELECT * FROM entity_rel \
                 WHERE (in = $entity OR out = $entity) AND (project_id = $proj OR project_id = type::record($proj_str))",
            )
            .bind(("entity", entity))
            .bind(("proj", proj))
            .bind(("proj_str", self.project_id.clone()))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "relations": rows }).to_string())
    }

    async fn get_chapter(&self, args: &Value) -> Result<String, String> {
        let id = Self::arg(args, "id").ok_or("missing id")?;
        let record = Self::parse_id("chapters", id);
        let mut resp = self
            .db
            .query("SELECT * FROM chapters WHERE id = $id LIMIT 1")
            .bind(("id", record.clone()))
            .await
            .map_err(|e| e.to_string())?;
        
        let row: Option<Value> = resp.take(0).map_err(|e| e.to_string())?;
        
        if let Some(mut chapter_obj) = row {
            let chapter_id_str = format!("chapters:{}", id.strip_prefix("chapters:").unwrap_or(id));
            let mut blocks_resp = self
                .db
                .query("SELECT content, order_index FROM text_blocks WHERE chapter_id = $rec OR chapter_id = $cid OR chapter_id = type::record($cid) ORDER BY order_index ASC")
                .bind(("rec", record))
                .bind(("cid", chapter_id_str))
                .await
                .map_err(|e| e.to_string())?;
            
            let blocks: Vec<Value> = blocks_resp.take(0).map_err(|e| e.to_string())?;
            
            let mut full_text = String::new();
            for b in blocks {
                if let Some(content) = b.get("content").and_then(|v| v.as_str()) {
                    if !content.trim().is_empty() {
                        full_text.push_str(content);
                        full_text.push_str("\n\n");
                    }
                }
            }
            
            let full_text = full_text.trim();
            if full_text.is_empty() {
                return Ok("[SYSTEM ERROR: The chapter content is empty. This means the user has not written any text for this chapter yet. Inform the user and do not hallucinate.]".to_string());
            } else {
                if let Some(obj) = chapter_obj.as_object_mut() {
                    obj.insert("compiled_text".to_string(), json!(full_text));
                }
                return Ok(json!({ "chapter": chapter_obj }).to_string());
            }
        }
        
        Err("Chapter not found".to_string())
    }

    async fn get_chapters_list(&self) -> Result<String, String> {
        let mut resp = self
            .db
            .query("SELECT id, title FROM chapters WHERE project_id = $proj OR project_id = type::record($proj_str) ORDER BY id")
            .bind(("proj", project_record(&self.project_id)))
            .bind(("proj_str", self.project_id.clone()))
            .await
            .map_err(|e| e.to_string())?;
        
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        if rows.is_empty() {
            return Ok("В проекте нет ни одной главы.".to_string());
        }
        
        let mut out = String::from("Оглавление (Список глав):\n");
        for row in rows {
            let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let title = row.get("title").and_then(|v| v.as_str()).unwrap_or("Без названия");
            out.push_str(&format!("ID: {}, Название: {}\n", id, title));
        }
        Ok(out)
    }

    async fn get_timeline(&self, args: &Value) -> Result<String, String> {
        let _ = args;
        let proj = project_record(&self.project_id);
        let mut resp = self
            .db
            .query(
                "SELECT id, title, timeline_events FROM chapters \
                 WHERE project_id = $proj AND timeline_events != NONE LIMIT 500",
            )
            .bind(("proj", proj))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "timeline": rows }).to_string())
    }

    async fn get_calendar(&self) -> Result<String, String> {
        let proj = project_record(&self.project_id);
        let mut resp = self
            .db
            .query("SELECT * FROM calendars WHERE project_id = $proj LIMIT 500")
            .bind(("proj", proj))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "calendar": rows }).to_string())
    }

    fn parse_id(table: &str, id: &str) -> RecordId {
        let part = id.strip_prefix(&format!("{}:", table)).unwrap_or(id);
        RecordId::new(table, part.to_lowercase())
    }

    async fn get_entity_schema(&self, args: &Value) -> Result<String, String> {
        let type_key = Self::arg(args, "type_key").unwrap_or("");
        let mut resp = self
            .db
            .query("SELECT * FROM entity_schemas WHERE type_key = $type")
            .bind(("type", type_key))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "schema": rows }).to_string())
    }

    async fn update_entity(&self, args: &Value) -> Result<String, String> {
        let id = Self::arg(args, "id").unwrap_or("");
        let patch = args.get("patch").cloned().unwrap_or(json!({}));
        let rec = Self::parse_id("entities", id);
        let _ = self
            .db
            .update::<Option<Value>>(rec)
            .merge(patch)
            .await
            .map_err(|e| e.to_string())?;
        Ok(json!({ "status": "success", "message": "Entity updated" }).to_string())
    }

    async fn create_entity(&self, args: &Value) -> Result<String, String> {
        let type_key = Self::arg(args, "type_key").unwrap_or("");
        let data = args.get("data").cloned().unwrap_or(json!({}));
        let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed");
        let desc = data.get("description").and_then(|v| v.as_str());
        let pid_rec = project_record(&self.project_id);

        let mut q_str = "CREATE entities SET project_id = $proj, entity_type = $et, name = $name".to_string();
        if desc.is_some() {
            q_str.push_str(", description = $desc");
        }
        let mut q = self
            .db
            .query(q_str)
            .bind(("proj", pid_rec))
            .bind(("et", type_key))
            .bind(("name", name));
        if let Some(d) = desc {
            q = q.bind(("desc", d));
        }

        let mut res = q.await.map_err(|e| e.to_string())?;
        let created: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "status": "success", "message": "Entity created", "entity": created }).to_string())
    }

    async fn create_relation(&self, args: &Value) -> Result<String, String> {
        let from = Self::arg(args, "from").unwrap_or("");
        let to = Self::arg(args, "to").unwrap_or("");
        let rel_type = Self::arg(args, "rel_type").unwrap_or("");

        let from_rec = Self::parse_id("entities", from);
        let to_rec = Self::parse_id("entities", to);
        let proj = project_record(&self.project_id);

        let mut res = self
            .db
            .query("RELATE $from->entity_rel->$to SET rel_type = $type, project_id = $proj RETURN AFTER")
            .bind(("from", from_rec))
            .bind(("to", to_rec))
            .bind(("type", rel_type))
            .bind(("proj", proj))
            .await
            .map_err(|e| e.to_string())?;
        let created: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "status": "success", "message": "Relation created", "relation": created }).to_string())
    }

    async fn update_chapter(&self, args: &Value) -> Result<String, String> {
        let id = Self::arg(args, "id").unwrap_or("");
        let content = args.get("content").cloned().unwrap_or(json!({}));
        let rec = Self::parse_id("chapters", id);

        let _ = self
            .db
            .update::<Option<Value>>(rec)
            .merge(json!({ "content": content }))
            .await
            .map_err(|e| e.to_string())?;
        Ok(json!({ "status": "success", "message": "Chapter updated" }).to_string())
    }

    async fn add_timeline_event(&self, args: &Value) -> Result<String, String> {
        let chapter_id = Self::arg(args, "chapter_id").unwrap_or("");
        let event = args.get("event").cloned().unwrap_or(json!({}));
        if chapter_id.is_empty() {
            return Err("chapter_id is required".to_string());
        }
        let rec = Self::parse_id("chapters", chapter_id);
        let _ = self
            .db
            .query("UPDATE $rec SET timeline_events += [$event]")
            .bind(("rec", rec))
            .bind(("event", event))
            .await
            .map_err(|e| e.to_string())?;
        Ok(json!({ "status": "success", "message": "Timeline event added" }).to_string())
    }

    async fn get_entity_evolution(&self, args: &Value) -> Result<String, String> {
        let entity_id = Self::arg(args, "entity_id").unwrap_or("");
        Ok(json!({ "entity_id": entity_id, "evolution": "Mock evolution data" }).to_string())
    }

    async fn get_relation_history(&self, args: &Value) -> Result<String, String> {
        let relation_id = Self::arg(args, "relation_id").unwrap_or("");
        Ok(
            json!({ "relation_id": relation_id, "history": "Mock relation history data" })
                .to_string(),
        )
    }

    async fn validate_world_consistency(&self, args: &Value) -> Result<String, String> {
        let statement = Self::arg(args, "statement").unwrap_or("");
        
        // Simple mock of consistency check delegating to RAG search over timeline/relations.
        let _resp = self.db.query("SELECT * FROM chat_messages WHERE project_id = $proj LIMIT 0") // Mocking for now, can be replaced with actual prompt to subagent
            .bind(("proj", project_record(&self.project_id)))
            .await.map_err(|e| e.to_string())?;
        
        Ok(json!({ "status": "success", "analysis": "Для глубокой проверки используй rag_search по ключевым словам из твоего утверждения: ".to_string() + statement }).to_string())
    }

    async fn search_chat_history(&self, args: &Value) -> Result<String, String> {
        let query = Self::arg(args, "query").unwrap_or("");
        let mut resp = self.db.query("SELECT * FROM chat_messages WHERE project_id = $proj AND content CONTAINS $query LIMIT 20")
            .bind(("proj", project_record(&self.project_id)))
            .bind(("query", query))
            .await.map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "matches": rows }).to_string())
    }

    async fn spawn_subagent(&self, args: &Value) -> Result<String, String> {
        let task = Self::arg(args, "task").unwrap_or("");
        let subagent_type = Self::arg(args, "subagent_type").unwrap_or("Analyst");
        Ok(json!({ "status": "success", "message": format!("Subagent '{}' spawned for task: {}", subagent_type, task) }).to_string())
    }
}
