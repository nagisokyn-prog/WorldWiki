//! Интеграция с clawrust (vendor/claw-code).
//!
//! Берём из clawrust ровно то, что он даёт готовым: слой «отправка / обработка /
//! приём ответов» — `claw_api::ProviderClient` + `MessageStream` (SSE-стриминг с
//! дельтами, retry, провайдер-роутинг). CLI и файловые/tools-крейты сюда НЕ
//! тащим.
//!
//! WorldWiki-специфичным остаётся: построение запроса из ветки чата, системный
//! промпт с RAG-грaундингом, набор read-only тулов поверх SurrealDB и склейка со
//! событиями UI (`chat_stream_chunk`). Write-тулов в v1 нет — агент читает БД
//! через RAG, но не меняет её.

use claw_api::{
    AnthropicClient, AuthSource, ContentBlockDelta, ContentBlockDeltaEvent, ContentBlockStartEvent,
    InputContentBlock, InputMessage, MessageRequest, OpenAiCompatClient, OpenAiCompatConfig,
    OutputContentBlock, ProviderClient, StreamEvent, ToolDefinition,
};
use serde::Serialize;
use serde_json::{json, Value};
use surreal_domain::SurrealDb as _;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use tauri::{AppHandle, Emitter, Manager};

use crate::logic::ai_chat::get_chat_messages_impl;
use crate::AppState;

/// Стоп-критерии и лимиты (контекстное окно).
pub const MAX_AGENT_ITERATIONS: usize = 8;
pub const DEFAULT_MAX_TOKENS: u32 = 4096;
/// Бюджет на историю, отдаваемую модели (приблизительно, в символах).
const HISTORY_CHAR_BUDGET: usize = 120_000;
const RAG_TOP_K: usize = 8;

/// Чанк текста для плавной отрисовки ответа (контракт с фронтендом).
#[derive(Clone, Serialize)]
pub struct StreamChunk {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub is_done: bool,
    pub chunk_type: String,
}

/// Событие о вызове инструмента (для возможного отображения в UI).
#[derive(Clone, Serialize)]
pub struct AgentToolEvent {
    pub chat_id: String,
    pub message_id: String,
    pub tool_name: String,
    pub tool_args: Value,
}

/// Строит клиент провайдера из полей AI-профиля (api_key/base_url из БД, не env).
fn build_provider_client(
    provider: &str,
    api_key: &str,
    base_url: Option<String>,
) -> Result<ProviderClient, String> {
    let api_key = api_key.trim().to_string();

    let base_url = base_url.and_then(|s| {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            None
        } else if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            Some(format!("https://{}", trimmed))
        } else {
            Some(trimmed.to_string())
        }
    });

    let mut headers = reqwest::header::HeaderMap::new();
    if provider == "openrouter" {
        headers.insert(
            "HTTP-Referer",
            reqwest::header::HeaderValue::from_static("https://worldwiki.app"),
        );
        headers.insert(
            "X-Title",
            reqwest::header::HeaderValue::from_static("WorldWiki"),
        );
    }

    let http_client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    match provider {
        "anthropic" => {
            // Anthropic client doesn't expose with_http_client directly in this wrapper,
            // but its builder error is less common without custom headers.
            let client = AnthropicClient::from_auth(AuthSource::ApiKey(api_key))
                .with_base_url(base_url.unwrap_or_else(|| "https://api.anthropic.com".to_string()));
            Ok(ProviderClient::Anthropic(client))
        }
        // Все эти провайдеры говорят на OpenAI-совместимом проводе.
        "openai" | "openrouter" | "gemini" | "local" | "ollama" | "deepseek" => {
            let default_url = match provider {
                "openai" => "https://api.openai.com/v1",
                "openrouter" => "https://openrouter.ai/api/v1",
                "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai",
                "deepseek" => "https://api.deepseek.com/v1",
                // local / ollama / lm studio
                _ => "http://localhost:8080/v1",
            };
            let resolved = base_url.unwrap_or_else(|| default_url.to_string());
            let client = OpenAiCompatClient::new(api_key, OpenAiCompatConfig::openai())
                .with_base_url(resolved)
                .with_http_client(http_client);
            Ok(ProviderClient::OpenAi(client))
        }
        other => Err(format!("unsupported provider: {other}")),
    }
}

fn str_schema(description: &str) -> serde_json::Value {
    json!({ "type": "string", "description": description })
}

/// Read-only набор тулов агента (RAG поверх SurrealDB).
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
            description: Some("Получить содержимое главы по id.".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": { "id": str_schema("id главы") },
                "required": ["id"]
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
    ]
}

/// Read-only исполнитель инструментов поверх SurrealDB. Никаких записей.
pub struct WorldWikiTools {
    pub db: Surreal<Db>,
    pub project_id: String,
}

/// Нормализует project_id до RecordId `projects:<part>` (поля в схеме — record<projects>).
fn project_record(project_id: &str) -> RecordId {
    let part = project_id
        .strip_prefix("projects:")
        .unwrap_or(project_id)
        .trim_matches('`')
        .to_string();
    RecordId::new("projects", part)
}

impl WorldWikiTools {
    async fn run(&self, name: &str, args: &Value) -> Result<String, String> {
        match name {
            "rag_search" => self.rag_search(args).await,
            "search_entities" => self.search_entities(args).await,
            "get_entity" => self.get_entity(args).await,
            "get_relations" => self.get_relations(args).await,
            "get_chapter" => self.get_chapter(args).await,
            "get_timeline" => self.get_timeline(args).await,
            "get_calendar" => self.get_calendar().await,
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
        // Таблицы, по которым ищем. Поиск грубый (по всё JSON), устойчив к схеме.
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
                .query(format!(
                    "SELECT * FROM type::table($tab) WHERE project_id = $proj LIMIT 500"
                ))
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
        let id = Self::arg(args, "id").ok_or("missing id")?.to_lowercase();
        let record = RecordId::new("entities", id.as_str());
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
                 WHERE (in = $entity OR out = $entity) AND project_id = $proj",
            )
            .bind(("entity", entity))
            .bind(("proj", proj))
            .await
            .map_err(|e| e.to_string())?;
        let rows: Vec<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "relations": rows }).to_string())
    }

    async fn get_chapter(&self, args: &Value) -> Result<String, String> {
        let id = Self::arg(args, "id").ok_or("missing id")?;
        let record = RecordId::new("chapters", id.to_lowercase());
        let mut resp = self
            .db
            .query("SELECT * FROM chapters WHERE id = $id LIMIT 1")
            .bind(("id", record))
            .await
            .map_err(|e| e.to_string())?;
        let row: Option<Value> = resp.take(0).map_err(|e| e.to_string())?;
        Ok(json!({ "chapter": row }).to_string())
    }

    async fn get_timeline(&self, args: &Value) -> Result<String, String> {
        let _ = args;
        // Таймлайн живёт в chapters.timeline_events (отдельной таблицы timeline нет).
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
}

/// Системный промпт: агент-соавтор, отвечает только по данным из БД (RAG).
fn build_system_prompt(custom_instructions: &str, project_id: &str) -> String {
    let base = "Ты — соавтор и редактор писательской вселенной в приложении WorldWiki. \
        Ты умеешь ЧИТАТЬ данные проекта (сущности, главы, тома, арки, связи, таймлайн, календарь) \
        через специальные инструменты и обязана опираться на них. \
        Правила: \
        1) Прежде чем отвечать о фактах мира, вызови rag_search или точечный read-инструмент. \
        2) НЕ выдумывай фактов, которых нет в данных. Если данных нет — так и скажи. \
        3) Ты работаешь в режиме «только чтение»: не изменяй и не создавай данные. \
        4) Отвечай развёрнуто и структурно (Markdown), как соавтор-редактор.";
    let mut out = format!(
        "{base}\n\nПроект: {project_id}\nДоступные данные: entities, chapters, text_blocks, \
         volumes, arcs, entity_rel, calendars, user_dictionary. \
         Таймлайн хранится в chapters.timeline_events."
    );
    if !custom_instructions.trim().is_empty() {
        out.push_str("\n\nДополнительные указания пользователя:\n");
        out.push_str(custom_instructions.trim());
    }
    out
}

fn history_to_input_messages(history: &[Value], assistant_msg_id: &str) -> Vec<InputMessage> {
    use std::collections::HashMap;

    let mut map: HashMap<String, &Value> = HashMap::new();
    for msg in history {
        if let Some(id) = msg.get("id").and_then(|v| v.as_str()) {
            map.insert(id.to_string(), msg);
        }
    }

    let mut chain = Vec::new();
    let mut current_id = Some(assistant_msg_id.to_string());
    
    while let Some(id) = current_id {
        if let Some(msg) = map.get(&id) {
            chain.push(*msg); // Newest first
            
            let parent_val = msg.get("parent_id");
            if parent_val.is_none() || parent_val.unwrap().is_null() {
                current_id = None;
            } else if let Some(parent_id) = parent_val.unwrap().as_str() {
                if parent_id == "NONE" || parent_id.is_empty() {
                    current_id = None;
                } else {
                    current_id = Some(parent_id.to_string());
                }
            } else {
                current_id = None;
            }
        } else {
            break;
        }
    }

    let mut total = 0usize;
    let mut out = Vec::new();
    
    // Process from newest to oldest to keep latest messages within budget
    for msg in chain {
        let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|v| v.as_str()).unwrap_or("");
        
        let is_active = msg.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true);
        if !is_active {
            continue;
        }
        
        if role == "assistant" && content.is_empty() {
            continue;
        }
        
        if total + content.len() > HISTORY_CHAR_BUDGET {
            break;
        }
        
        total += content.len();
        if role == "assistant" {
            out.push(InputMessage {
                role: "assistant".to_string(),
                content: vec![InputContentBlock::Text {
                    text: content.to_string(),
                }],
            });
        } else {
            out.push(InputMessage::user_text(content.to_string()));
        }
    }
    
    // Restore chronological order
    out.reverse();
    out
}

/// Текущее состояние сборки одного tool-use из дельт стрима.
struct ToolAssembler {
    id: String,
    name: String,
    input_buf: String,
}

/// Запускает цикл агента в фоне (обёртка с таймаутом).
///
/// Гарантирует, что в любом случае во Vue уйдёт финальный чанк `chat_stream_chunk`
/// с `is_done: true`, чтобы `useWowilonPanel` сбрасывал состояние генерации.
pub async fn run_agent_loop(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
) {
    println!("[AGENT] started: chat={chat_id} project={project_id}");

    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.surreal_db().clone();

    // Read timeout_mins from active profile
    let mut timeout_secs = 1800; // 30 mins default
    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();

    let mut q =
        db.query("SELECT * FROM ai_profiles WHERE is_active = true AND project_id = $proj LIMIT 1");
    q = q.bind(("proj", RecordId::new("projects", proj_part.as_str())));
    if let Ok(mut resp) = q.await {
        if let Ok(Some(profile)) = resp.take::<Option<Value>>(0) {
            let settings = profile.get("settings").cloned().unwrap_or(json!({}));
            if let Some(tm) = settings.get("timeout_mins").and_then(|v| v.as_u64()) {
                timeout_secs = tm * 60;
            }
        }
    }

    let outcome = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        run_agent_inner(
            app.clone(),
            project_id.clone(),
            chat_id.clone(),
            assistant_msg_id.clone(),
            _user_text,
        ),
    )
    .await;

    if outcome.is_err() {
        println!("[AGENT] timeout: chat={chat_id}");
        let _ = app.emit(
            "chat_stream_chunk",
            StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text: format!(
                    "Превышено время ожидания ответа ИИ ({} с). Попробуйте ещё раз.",
                    timeout_secs
                ),
                is_done: true,
                chunk_type: "text".to_string(),
            },
        );
    }
}

/// Внутренняя логика агента: профиль, история, запрос через claw `api`-слой со
/// стримингом, read-тулы, сохранение ответа в `chat_messages`.
async fn run_agent_inner(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
) {
    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.surreal_db().clone();

    let emit_chunk = |text: String, is_done: bool, chunk_type: &str| {
        let _ = app.emit(
            "chat_stream_chunk",
            StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text,
                is_done,
                chunk_type: chunk_type.to_string(),
            },
        );
    };
    let emit_tool = |tool_name: String, tool_args: Value| {
        let _ = app.emit(
            "agent_tool",
            AgentToolEvent {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                tool_name,
                tool_args,
            },
        );
    };

    macro_rules! emit_err {
        ($err_msg:expr) => {{
            let text = $err_msg.to_string();
            let clean_id = assistant_msg_id.trim_matches('`');
            let parts: Vec<&str> = clean_id.split(':').collect();
            let rec_id = if parts.len() == 2 {
                surrealdb::types::RecordId::new(parts[0], parts[1])
            } else {
                surrealdb::types::RecordId::new("chat_messages", clean_id)
            };
            if let Err(e) = db
                .query("UPDATE $id SET content = $content, updated_at = time::now()")
                .bind(("id", rec_id))
                .bind(("content", text.clone()))
                .await
            {
                eprintln!("[AGENT ERROR] Failed to save error message to DB: {}", e);
            }
            emit_chunk(text, true, "text");
        }};
    }
    // --- 1. Активный AI-профиль ---
    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();
    // Если project_id пуст/битый — ищем только глобальный профиль.
    let (profile_sql, has_proj) = if proj_part.is_empty() {
        (
            "SELECT * FROM ai_profiles WHERE is_global = true AND is_active = true LIMIT 1",
            false,
        )
    } else {
        (
            "SELECT * FROM ai_profiles WHERE (project_id = $proj OR is_global = true) AND is_active = true LIMIT 1",
            true,
        )
    };
    let mut q = db.query(profile_sql);
    if has_proj {
        q = q.bind(("proj", RecordId::new("projects", proj_part.as_str())));
    }
    let mut profile_resp = match q.await {
        Ok(r) => r,
        Err(e) => {
            emit_err!(format!("Ошибка базы данных при чтении профиля: {e}"));
            return;
        }
    };
    let active_profile: Option<Value> = match profile_resp.take(0) {
        Ok(v) => v,
        Err(e) => {
            emit_err!(format!("Ошибка чтения профиля: {e}"));
            return;
        }
    };
    let Some(profile) = active_profile else {
        emit_err!("Нет активного AI-профиля. Пожалуйста, настройте провайдера в настройках ИИ.");
        return;
    };

    let provider = profile
        .get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let api_key = profile
        .get("api_key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let base_url = profile
        .get("base_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let settings = profile.get("settings").cloned().unwrap_or(json!({}));
    let model = settings
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let temperature = settings
        .get("temperature")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.7);
    let max_tokens = settings
        .get("max_tokens")
        .and_then(|v| v.as_u64())
        .map_or(DEFAULT_MAX_TOKENS, |v| (v as u32).max(1));
    let custom_instructions = settings
        .get("custom_instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if model.is_empty() {
        emit_err!("В активном AI-профиле не выбрана модель.");
        return;
    }
    let provider_client = match build_provider_client(&provider, &api_key, base_url) {
        Ok(c) => c,
        Err(e) => {
            emit_err!(format!("Не удалось настроить провайдера: {e}"));
            return;
        }
    };

    // --- 2. История чата ---
    let history = match get_chat_messages_impl(&db, &chat_id).await {
        Ok(v) => v,
        Err(e) => {
            emit_err!(format!("Ошибка загрузки истории: {e}"));
            return;
        }
    };
    let mut messages = history_to_input_messages(&history, &assistant_msg_id);
    if messages.is_empty() {
        emit_err!("История чата пуста.");
        return;
    }

    let system = build_system_prompt(&custom_instructions, &project_id);
    let tools_def = tool_definitions();
    let ww_tools = WorldWikiTools {
        db: db.clone(),
        project_id: project_id.clone(),
    };

    let mut req = MessageRequest {
        model: model.clone(),
        max_tokens,
        messages: messages.clone(),
        system: Some(system.clone()),
        tools: Some(tools_def.clone()),
        temperature: Some(temperature),
        stream: true,
        ..Default::default()
    };

    if let Some(effort) = settings.get("reasoning_effort").and_then(|v| v.as_str()) {
        if effort != "none" && !effort.is_empty() {
            req.extra_body
                .insert("reasoning".to_string(), json!({ "effort": effort }));
        }
    }

    // --- 3. Основной цикл ---
    let mut final_answer: Option<String> = None;
    let mut last_text = String::new();
    let mut accumulated_reasoning = String::new();
    let mut all_tool_logs: Vec<String> = Vec::new();

    for _iteration in 0..MAX_AGENT_ITERATIONS {
        req.messages = messages.clone();

        let mut stream = match provider_client.stream_message(&req).await {
            Ok(s) => s,
            Err(e) => {
                emit_err!(format!("Ошибка запроса к ИИ: {e}"));
                return;
            }
        };

        let mut assistant_text = String::new();
        let mut tool_uses: Vec<(String, String, Value)> = Vec::new();
        let mut assembler: Option<ToolAssembler> = None;

        loop {
            let next = match stream.next_event().await {
                Ok(n) => n,
                Err(e) => {
                    emit_err!(format!("Ошибка стрима ИИ: {e}"));
                    return;
                }
            };
            let Some(ev) = next else { break };
            match ev {
                StreamEvent::ContentBlockStart(ContentBlockStartEvent {
                    content_block: OutputContentBlock::ToolUse { id, name, input },
                    ..
                }) => {
                    let initial = match &input {
                        Value::Object(map) if map.is_empty() => String::new(),
                        Value::Null => String::new(),
                        other => other.to_string(),
                    };
                    let log_msg = format!("Используется инструмент: {}", name);
                    all_tool_logs.push(log_msg.clone());
                    emit_chunk(log_msg, false, "tool_log");

                    assembler = Some(ToolAssembler {
                        id,
                        name,
                        input_buf: initial,
                    });
                }
                StreamEvent::ContentBlockStart(ContentBlockStartEvent {
                    content_block: OutputContentBlock::Thinking { thinking, .. },
                    ..
                }) => {
                    accumulated_reasoning.push_str(&thinking);
                    if !thinking.is_empty() {
                        emit_chunk(thinking.clone(), false, "reasoning");
                    }
                }
                StreamEvent::ContentBlockDelta(ContentBlockDeltaEvent { delta, .. }) => match delta
                {
                    ContentBlockDelta::TextDelta { text } => {
                        assistant_text.push_str(&text);
                        emit_chunk(assistant_text.clone(), false, "text");
                    }
                    ContentBlockDelta::ThinkingDelta { thinking } => {
                        accumulated_reasoning.push_str(&thinking);
                        emit_chunk(thinking.clone(), false, "reasoning");
                    }
                    ContentBlockDelta::InputJsonDelta { partial_json } => {
                        if let Some(a) = assembler.as_mut() {
                            a.input_buf.push_str(&partial_json);
                        }
                    }
                    _ => {}
                },
                StreamEvent::ContentBlockStop(_) => {
                    if let Some(a) = assembler.take() {
                        let input = serde_json::from_str(&a.input_buf)
                            .unwrap_or_else(|_| json!({ "raw": a.input_buf }));
                        tool_uses.push((a.id, a.name, input));
                    }
                }
                StreamEvent::MessageStart(start) => {
                    let u = start.message.usage;
                    let u_json = serde_json::json!({
                        "input_tokens": u.input_tokens,
                        "output_tokens": u.output_tokens,
                        "total_tokens": u.total_tokens()
                    });
                    emit_chunk(u_json.to_string(), false, "usage");
                }
                StreamEvent::MessageDelta(delta) => {
                    let u = delta.usage;
                    if u.total_tokens() > 0 {
                        let u_json = serde_json::json!({
                            "input_tokens": u.input_tokens,
                            "output_tokens": u.output_tokens,
                            "total_tokens": u.total_tokens()
                        });
                        emit_chunk(u_json.to_string(), false, "usage");
                    }
                }
                StreamEvent::MessageStop(_) => break,
                _ => {}
            }
        }

        // Финальный блок, если стрим завершился без MessageStop.
        if let Some(a) = assembler.take() {
            let input = serde_json::from_str(&a.input_buf)
                .unwrap_or_else(|_| json!({ "raw": a.input_buf }));
            tool_uses.push((a.id, a.name, input));
        }

        last_text = assistant_text.clone();

        if tool_uses.is_empty() {
            final_answer = Some(assistant_text);
            break;
        }

        // Добавляем сообщение ассистента с tool-use и результаты инструментов.
        let mut blocks = Vec::new();
        if !assistant_text.is_empty() {
            blocks.push(InputContentBlock::Text {
                text: assistant_text,
            });
        }
        for (id, name, input) in &tool_uses {
            blocks.push(InputContentBlock::ToolUse {
                id: id.clone(),
                name: name.clone(),
                input: input.clone(),
            });
        }
        messages.push(InputMessage {
            role: "assistant".to_string(),
            content: blocks,
        });

        let mut any_error = false;
        for (id, name, input) in &tool_uses {
            emit_tool(name.clone(), input.clone());
            let result = ww_tools.run(name, input).await;
            let (out, is_err) = match result {
                Ok(o) => (o, false),
                Err(e) => {
                    any_error = true;
                    (format!("tool error: {e}"), true)
                }
            };
            messages.push(InputMessage::user_tool_result(id.clone(), out, is_err));
        }
        if any_error {
            break;
        }
    } // конец цикла итераций

    let answer = final_answer.unwrap_or(last_text);

    //--- 4. Сохраняем ответ ассистента в БД и финальный чанк ---
    let clean_id = assistant_msg_id.trim_matches('`');
    let parts: Vec<&str> = clean_id.split(':').collect();
    let rec_id = if parts.len() == 2 {
        surrealdb::types::RecordId::new(parts[0], parts[1])
    } else {
        surrealdb::types::RecordId::new("chat_messages", clean_id)
    };
    if let Err(e) = db
        .query("UPDATE $id SET content = $content, reasoning = $reasoning, tool_logs = $tool_logs, updated_at = time::now()")
        .bind(("id", rec_id))
        .bind(("content", answer.clone()))
        .bind(("reasoning", if accumulated_reasoning.is_empty() { None } else { Some(accumulated_reasoning) }))
        .bind(("tool_logs", if all_tool_logs.is_empty() { None } else { Some(all_tool_logs) }))
        .await
    {
        eprintln!("[AGENT ERROR] Failed to save final message to DB: {}", e);
    }

    emit_chunk(answer, true, "text");
    println!("[AGENT] finished: chat={chat_id}");
}
