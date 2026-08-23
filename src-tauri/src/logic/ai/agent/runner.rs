use claw_api::{
    AnthropicClient, AuthSource, ContentBlockDelta, ContentBlockDeltaEvent, ContentBlockStartEvent,
    InputContentBlock, InputMessage, MessageRequest, OpenAiCompatClient, OpenAiCompatConfig,
    OutputContentBlock, ProviderClient, StreamEvent,
};
use serde::Serialize;
use serde_json::{json, Value};
use surreal_domain::SurrealDb as _;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use tauri::{AppHandle, Emitter, Manager};

use super::prompt::{
    build_system_prompt_with_context, history_to_input_messages,
    DEFAULT_MAX_TOKENS, MAX_AGENT_ITERATIONS,
};
use crate::logic::ai::chat::tree::get_chat_messages_impl;
use crate::logic::ai::retrieval::RetrievalRouter;
use crate::logic::ai::tools::WorldWikiTools;
use crate::AppState;

#[derive(Clone, Serialize)]
pub struct StreamChunk {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub is_done: bool,
    pub chunk_type: String,
}

#[derive(Clone, Serialize)]
pub struct AgentToolEvent {
    pub chat_id: String,
    pub message_id: String,
    pub tool_name: String,
    pub tool_args: Value,
}

struct ToolAssembler {
    id: String,
    name: String,
    input_buf: String,
}

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
            let client = AnthropicClient::from_auth(AuthSource::ApiKey(api_key))
                .with_base_url(base_url.unwrap_or_else(|| "https://api.anthropic.com".to_string()));
            Ok(ProviderClient::Anthropic(client))
        }
        "openai" | "openrouter" | "gemini" | "local" | "ollama" | "deepseek" => {
            let default_url = match provider {
                "openai" => "https://api.openai.com/v1",
                "openrouter" => "https://openrouter.ai/api/v1",
                "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai",
                "deepseek" => "https://api.deepseek.com/v1",
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

pub async fn run_agent_loop(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
    mode_slug: Option<String>,
) {
    println!("[AGENT] started: chat={chat_id} project={project_id}");

    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.surreal_db().clone();

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
            mode_slug,
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

async fn run_agent_inner(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
    mode_slug: Option<String>,
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

    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();

    let mut role_def = String::new();
    let mut mode_custom_instr = String::new();
    let mut override_profile_id = None;

    if let Some(slug) = mode_slug {
        let mode_sql = if proj_part.is_empty() {
            "SELECT * FROM ai_modes WHERE slug = $slug AND is_global = true LIMIT 1"
        } else {
            "SELECT * FROM ai_modes WHERE slug = $slug AND (project_id = $proj OR is_global = true) LIMIT 1"
        };
        let mut mq = db.query(mode_sql).bind(("slug", slug));
        if !proj_part.is_empty() {
            mq = mq.bind(("proj", RecordId::new("projects", proj_part.as_str())));
        }
        if let Ok(mut resp) = mq.await {
            if let Ok(Some(mode)) = resp.take::<Option<Value>>(0) {
                role_def = mode
                    .get("role_definition")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                mode_custom_instr = mode
                    .get("custom_instructions")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if let Some(p_id) = mode.get("api_profile_id").and_then(|v| v.as_str()) {
                    if !p_id.is_empty() {
                        let clean_pid = p_id.replace(['`', '⟨', '⟩'], "");
                        let parts: Vec<&str> = clean_pid.split(':').collect();
                        if parts.len() == 2 {
                            override_profile_id =
                                Some(surrealdb::types::RecordId::new(parts[0], parts[1]));
                        }
                    }
                }
            }
        }
    }

    let q = if let Some(pid) = override_profile_id {
        db.query("SELECT * FROM ai_profiles WHERE id = $pid LIMIT 1")
            .bind(("pid", pid))
    } else if proj_part.is_empty() {
        db.query("SELECT * FROM ai_profiles WHERE is_global = true AND is_active = true LIMIT 1")
    } else {
        db.query("SELECT * FROM ai_profiles WHERE (project_id = $proj OR is_global = true) AND is_active = true LIMIT 1")
            .bind(("proj", RecordId::new("projects", proj_part.as_str())))
    };

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
    let profile_custom_instructions = settings
        .get("custom_instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let combined_custom_instructions = if !mode_custom_instr.trim().is_empty() {
        if !profile_custom_instructions.trim().is_empty() {
            format!("{}\n{}", mode_custom_instr, profile_custom_instructions)
        } else {
            mode_custom_instr.clone()
        }
    } else {
        profile_custom_instructions
    };
    if model.is_empty() {
        emit_err!("В активном AI-профиле не выбрана модель.");
        return;
    }
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

    let enable_auto_rag = settings
        .get("enable_auto_rag")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let enable_semantic = settings
        .get("enable_semantic_search")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let last_user_query = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| {
            m.content.iter().find_map(|b| match b {
                InputContentBlock::Text { text } => Some(text.as_str()),
                _ => None,
            })
        })
        .unwrap_or("");

    let router = RetrievalRouter::default();
    let retrieved_context = if enable_auto_rag && !last_user_query.is_empty() {
        router.retrieve(&db, &project_id, last_user_query, enable_semantic).await
    } else {
        None
    };

    let is_local = provider == "local" && (model.ends_with(".gguf") || model.contains('/') || model.contains('\\'));
    let exec_policy = settings.get("execution_policy").and_then(|v| v.as_str()).unwrap_or("direct");

    let system = if is_local || exec_policy == "direct" {
        crate::logic::ai::agent::prompt::build_system_prompt_direct(
            &role_def,
            &combined_custom_instructions,
            &project_id,
            if is_local { None } else { retrieved_context.as_deref() },
        )
    } else {
        build_system_prompt_with_context(
            &role_def,
            &combined_custom_instructions,
            &project_id,
            retrieved_context.as_deref(),
        )
    };

    println!(
        "\n[PROMPT ASSEMBLY TRACE]\n├─ Provider: {} | Model: {}\n├─ Execution Policy: {}\n├─ Auto-RAG Context: {} chars\n├─ System Prompt: {} chars\n├─ Messages Count: {}\n└─ Reasoning Effort: {:?}",
        provider,
        model,
        exec_policy,
        retrieved_context.as_ref().map(|c| c.len()).unwrap_or(0),
        system.len(),
        messages.len(),
        settings.get("reasoning_effort").and_then(|v| v.as_str())
    );

    // Native in-process Local LLM inference (llama-turboquant-cpp)
    if provider == "local" && (model.ends_with(".gguf") || model.contains('/') || model.contains('\\')) {
        #[cfg(feature = "ai-local")]
        {
            let n_ctx = settings.get("n_ctx").and_then(|v| v.as_u64()).unwrap_or(16384) as u32;
            let n_gpu_layers = settings.get("n_gpu_layers").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
            let enable_tcq = settings.get("enable_tcq").and_then(|v| v.as_bool()).unwrap_or(true);
            let embed_model_path = settings.get("embed_model_path").and_then(|v| v.as_str()).map(|s| s.to_string());
            let triattention_path = settings.get("triattention_path").and_then(|v| v.as_str()).map(|s| s.to_string());
            let checkpoint_path = settings.get("checkpoint_path").and_then(|v| v.as_str()).map(|s| s.to_string());

            let mut formatted_prompt = String::new();
            if !system.trim().is_empty() {
                formatted_prompt.push_str(&format!("<|im_start|>system\n{}<|im_end|>\n", system.trim()));
            }
            for m in &messages {
                let role = if m.role == "user" { "user" } else { "assistant" };
                let text = m.content.iter().map(|block| match block {
                    InputContentBlock::Text { text } => text.clone(),
                    _ => String::new(),
                }).collect::<Vec<_>>().join(" ");
                if !text.trim().is_empty() {
                    formatted_prompt.push_str(&format!("<|im_start|>{role}\n{}<|im_end|>\n", text.trim()));
                }
            }
            formatted_prompt.push_str("<|im_start|>assistant\n");

            let last_user_query = messages
                .iter()
                .rev()
                .find(|m| m.role == "user")
                .map(|m| {
                    m.content
                        .iter()
                        .map(|block| match block {
                            InputContentBlock::Text { text } => text.clone(),
                            _ => String::new(),
                        })
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default();

            match crate::logic::ai::agent_runtime::run_local_agent_loop(
                app.clone(),
                project_id,
                chat_id.clone(),
                assistant_msg_id.clone(),
                last_user_query,
                formatted_prompt,
                model,
                embed_model_path,
                triattention_path,
                checkpoint_path,
                n_ctx,
                n_gpu_layers,
                enable_tcq,
            ).await {
                Ok(answer) => {
                    let clean_id = assistant_msg_id.trim_matches('`');
                    let parts: Vec<&str> = clean_id.split(':').collect();
                    let rec_id = if parts.len() == 2 {
                        surrealdb::types::RecordId::new(parts[0], parts[1])
                    } else {
                        surrealdb::types::RecordId::new("chat_messages", clean_id)
                    };
                    let _ = db
                        .query("UPDATE $id SET content = $content, updated_at = time::now()")
                        .bind(("id", rec_id))
                        .bind(("content", answer))
                        .await;
                    return;
                }
                Err(e) => {
                    emit_err!(format!("Ошибка локальной генерации: {e}"));
                    return;
                }
            }
        }
        #[cfg(not(feature = "ai-local"))]
        {
            emit_err!("Локальный LLM не скомпилирован. Пересоберите с feature 'ai-local'.");
            return;
        }
    }

    let provider_client = match build_provider_client(&provider, &api_key, base_url) {
        Ok(c) => c,
        Err(e) => {
            emit_err!(format!("Не удалось настроить провайдера: {e}"));
            return;
        }
    };
    let mut tools_def = crate::logic::ai::tools::tool_definitions();
    // If Auto-RAG successfully found context or is enabled, remove redundant search tools
    if enable_auto_rag && retrieved_context.is_some() {
        tools_def.retain(|t| t.name != "rag_search" && t.name != "search_entities");
    }

    let ww_tools = WorldWikiTools {
        db: db.clone(),
        project_id: project_id.clone(),
    };

    let execution_policy = settings
        .get("execution_policy")
        .and_then(|v| v.as_str())
        .unwrap_or("agentic");

    let tools_payload = if execution_policy == "direct" {
        None
    } else {
        Some(tools_def.clone())
    };

    let mut req = MessageRequest {
        model: model.clone(),
        max_tokens,
        messages: messages.clone(),
        system: Some(system.clone()),
        tools: tools_payload,
        temperature: Some(temperature),
        stream: true,
        ..Default::default()
    };

    if let Some(effort) = settings.get("reasoning_effort").and_then(|v| v.as_str()) {
        if effort != "none" && !effort.is_empty() {
            req.extra_body
                .insert("reasoning".to_string(), json!({ "effort": effort }));
            req.extra_body
                .insert("reasoning_effort".to_string(), json!(effort));
        }
    }
    if provider == "openrouter" {
        req.extra_body
            .insert("include_reasoning".to_string(), json!(true));
    }

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
                        emit_chunk(text, false, "text");
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
    }

    let answer = final_answer.unwrap_or(last_text);

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

    emit_chunk(String::new(), true, "text");
    println!("[AGENT] finished: chat={chat_id}");
}

#[tauri::command]
pub async fn get_ai_completion(
    text_before: String,
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let db = state.surreal_db();

    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();

    let q = if proj_part.is_empty() {
        db.query("SELECT * FROM ai_profiles WHERE is_global = true AND is_active = true LIMIT 1")
    } else {
        db.query("SELECT * FROM ai_profiles WHERE (project_id = $proj OR is_global = true) AND is_active = true LIMIT 1")
            .bind(("proj", surrealdb::types::RecordId::new("projects", proj_part.as_str())))
    };

    let mut profile_resp = q.await.map_err(|e| e.to_string())?;
    let profile: Option<Value> = profile_resp.take(0).unwrap_or_default();

    let mut provider = "openai".to_string();
    let mut api_key = String::new();
    let mut base_url = None;
    let mut model = "gpt-3.5-turbo".to_string();

    if let Some(prof) = profile {
        provider = prof
            .get("provider")
            .and_then(|v| v.as_str())
            .unwrap_or("openai")
            .to_string();
        api_key = prof
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        base_url = prof
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        if let Some(sets) = prof.get("settings").and_then(|v| v.as_object()) {
            if let Some(m) = sets.get("model").and_then(|v| v.as_str()) {
                model = m.to_string();
            }
        }
    }

    if api_key.is_empty() {
        return Err("API key not configured".to_string());
    }

    let provider_client = build_provider_client(&provider, &api_key, base_url)?;

    let system = "Ты - соавтор писателя. Твоя задача ПРОДОЛЖИТЬ текст романа, который пишет пользователь. \
        Верни ТОЛЬКО продолжение текста, начиная с того места, где остановился пользователь, без пояснений, \
        без кавычек. Длина продолжения: 1-3 предложения.".to_string();

    let messages = vec![InputMessage {
        role: "user".to_string(),
        content: vec![InputContentBlock::Text {
            text: format!(
                "Продолжи текст (верни только продолжение, не повторяй то, что я написал):\n\n{}",
                text_before
            ),
        }],
    }];

    let req = MessageRequest {
        model,
        max_tokens: 100,
        messages,
        system: Some(system),
        stream: false,
        ..Default::default()
    };

    let mut stream = provider_client
        .stream_message(&req)
        .await
        .map_err(|e| e.to_string())?;

    let mut answer = String::new();
    while let Ok(next) = stream.next_event().await {
        if let Some(event) = next {
            match event {
                StreamEvent::ContentBlockDelta(ContentBlockDeltaEvent {
                    delta: ContentBlockDelta::TextDelta { text },
                    ..
                }) => {
                    answer.push_str(&text);
                }
                StreamEvent::MessageStop(_) => {
                    break;
                }
                _ => {}
            }
        } else {
            break;
        }
    }

    Ok(answer)
}

#[tauri::command]
pub async fn generate_chat_title(
    chat_id: String,
    prompt_text: String,
    project_id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.surreal_db().clone();
    
    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();

    let mut q = db.query("SELECT * FROM ai_profiles WHERE is_active = true AND (project_id = $proj OR is_global = true) LIMIT 1");
    q = q.bind(("proj", RecordId::new("projects", proj_part.as_str())));
    let mut resp = q.await.map_err(|e| e.to_string())?;
    let profile: Option<Value> = resp.take(0).map_err(|e| e.to_string())?;
    
    if profile.is_none() {
        return Ok(());
    }
    let profile = profile.unwrap();

    let provider = profile.get("provider").and_then(|v| v.as_str()).unwrap_or("openai");
    let model = profile
        .get("settings")
        .and_then(|s| s.get("model"))
        .and_then(|m| m.as_str())
        .unwrap_or("gpt-3.5-turbo");
    let api_key = profile.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
    let base_url = profile
        .get("settings")
        .and_then(|s| s.get("base_url"))
        .and_then(|b| b.as_str())
        .map(|s| s.to_string());

    let provider_client = build_provider_client(provider, api_key, base_url)?;
    
    let messages = vec![InputMessage {
        role: "user".to_string(),
        content: vec![InputContentBlock::Text {
            text: format!("Придумай короткое название (от 2 до 5 слов) для чата, который начинается со следующего сообщения пользователя. Верни ТОЛЬКО само название, без кавычек, без точек в конце и без лишнего текста:\n\n{}", prompt_text),
        }],
    }];

    let req = MessageRequest {
        model: model.to_string(),
        max_tokens: 50,
        messages,
        system: None,
        stream: false,
        ..Default::default()
    };

    let mut stream = provider_client.stream_message(&req).await.map_err(|e| e.to_string())?;
    let mut answer = String::new();
    while let Ok(next) = stream.next_event().await {
        if let Some(event) = next {
            match event {
                StreamEvent::ContentBlockDelta(ContentBlockDeltaEvent {
                    delta: ContentBlockDelta::TextDelta { text },
                    ..
                }) => { answer.push_str(&text); }
                StreamEvent::MessageStop(_) => { break; }
                _ => {}
            }
        } else { break; }
    }

    let title = answer.trim().trim_matches('"').trim_matches('\'').trim_matches('«').trim_matches('»').to_string();
    if title.is_empty() { return Ok(()); }

    let clean_chat_id = chat_id.trim_matches('`');
    let parts: Vec<&str> = clean_chat_id.split(':').collect();
    let rec_id = if parts.len() == 2 {
        RecordId::new(parts[0], parts[1])
    } else {
        RecordId::new("chats", clean_chat_id)
    };

    db.query("UPDATE $id SET title = $title")
        .bind(("id", rec_id))
        .bind(("title", title))
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit("chat_tree_updated", ());
    Ok(())
}
