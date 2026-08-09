use dashmap::DashMap;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::oneshot;
use tokio::time::{sleep, Duration};
use surrealdb::types::RecordId;
use surreal_domain::SurrealDb;

/// Глобальный стейт для хранения активных ИИ-сессий и каналов связи для одобрения инструментов.
pub struct ActiveSessionsState {
    // chat_id -> channel
    pub tool_approvals: Arc<DashMap<String, oneshot::Sender<bool>>>,
}

impl Default for ActiveSessionsState {
    fn default() -> Self {
        Self {
            tool_approvals: Arc::new(DashMap::new()),
        }
    }
}

#[derive(Clone, Serialize)]
pub struct StreamChunk {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub is_done: bool,
}

#[derive(Clone, Serialize)]
pub struct ToolCallRequest {
    pub chat_id: String,
    pub tool_name: String,
    pub tool_args: Value,
    pub tool_call_id: String,
}

/// Асинхронный цикл агента. Работает в фоне.
pub async fn run_agent_loop(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
) {
    println!("[AGENT] Started loop for chat: {}, project: {}", chat_id, project_id);
    let state = app.state::<crate::AppState>();
    let db = state.surreal_db();

    // 1. Получаем активный AI-профиль
    let proj_id_part = if project_id.starts_with("projects:") {
        &project_id["projects:".len()..]
    } else {
        project_id.as_str()
    };
    
    let mut profile_resp = match db
        .query("SELECT * FROM ai_profiles WHERE (project_id = $proj OR is_global = true) AND is_active = true LIMIT 1")
        .bind(("proj", RecordId::new("projects", proj_id_part)))
        .await {
            Ok(r) => r,
            Err(e) => {
                let _ = app.emit("chat_stream_chunk", StreamChunk {
                    chat_id: chat_id.clone(),
                    message_id: assistant_msg_id.clone(),
                    text: format!("Ошибка базы данных: {}", e),
                    is_done: true,
                });
                return;
            }
        };

    let active_profile: Option<Value> = profile_resp.take(0).unwrap_or(None);
    if active_profile.is_none() {
        let _ = app.emit("chat_stream_chunk", StreamChunk {
            chat_id: chat_id.clone(),
            message_id: assistant_msg_id.clone(),
            text: "Нет активного AI-профиля. Пожалуйста, настройте провайдера в настройках ИИ.".to_string(),
            is_done: true,
        });
        return;
    }
    let profile = active_profile.unwrap();
    let provider = profile["provider"].as_str().unwrap_or("").to_string();
    let api_key = profile["api_key"].as_str().unwrap_or("").to_string();
    let base_url = profile["base_url"].as_str().map(|s| s.to_string());
    
    let settings = &profile["settings"];
    let model = settings["model"].as_str().unwrap_or("").to_string();
    let temperature = settings["temperature"].as_f64().unwrap_or(0.7);

    if model.is_empty() {
        let _ = app.emit("chat_stream_chunk", StreamChunk {
            chat_id: chat_id.clone(),
            message_id: assistant_msg_id.clone(),
            text: "В активном AI-профиле не выбрана модель.".to_string(),
            is_done: true,
        });
        return;
    }

    // 2. Достаем историю сообщений чата (исключая текущее пустое сообщение ассистента)
    let chat_id_part = if chat_id.starts_with("chats:") {
        &chat_id["chats:".len()..]
    } else {
        chat_id.as_str()
    };

    let mut msgs_resp = match db
        .query("SELECT role, content FROM chat_messages WHERE chat_id = $chat_id AND id != $ass_id ORDER BY created_at ASC")
        .bind(("chat_id", RecordId::new("chats", chat_id_part)))
        .bind(("ass_id", RecordId::new("chat_messages", assistant_msg_id.as_str())))
        .await {
            Ok(r) => r,
            Err(e) => {
                let _ = app.emit("chat_stream_chunk", StreamChunk {
                    chat_id: chat_id.clone(),
                    message_id: assistant_msg_id.clone(),
                    text: format!("Ошибка загрузки истории: {}", e),
                    is_done: true,
                });
                return;
            }
        };

    let db_messages: Vec<Value> = msgs_resp.take(0).unwrap_or_else(|_| vec![]);
    let mut req_messages = Vec::new();

    // Добавляем кастомные инструкции (системный промпт) если есть
    if let Some(system_instructions) = settings["custom_instructions"].as_str() {
        if !system_instructions.is_empty() {
            req_messages.push(serde_json::json!({
                "role": "system",
                "content": system_instructions
            }));
        }
    }

    for msg in db_messages {
        let role = msg["role"].as_str().unwrap_or("user");
        let content = msg["content"].as_str().unwrap_or("");
        req_messages.push(serde_json::json!({
            "role": role,
            "content": content
        }));
    }

    // 3. Формируем запрос к провайдеру
    let client = reqwest::Client::new();
    let response_text = match call_provider_api(&client, &provider, &api_key, base_url.as_deref(), &model, req_messages, temperature).await {
        Ok(text) => text,
        Err(e) => {
            let _ = app.emit("chat_stream_chunk", StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text: format!("Ошибка отправки запроса к ИИ: {}", e),
                is_done: true,
            });
            return;
        }
    };

    // 4. Сохраняем ответ ассистента в базу данных
    let _ = db.query("UPDATE type::thing('chat_messages', $id) SET content = $content, updated_at = time::now()")
        .bind(("id", assistant_msg_id.clone()))
        .bind(("content", response_text.clone()))
        .await;

    // 5. Имитируем стриминг для плавного отображения (посимвольно/пословесно)
    let words: Vec<&str> = response_text.split_inclusive(' ').collect();
    let mut accumulated = String::new();
    for word in words {
        accumulated.push_str(word);
        let _ = app.emit("chat_stream_chunk", StreamChunk {
            chat_id: chat_id.clone(),
            message_id: assistant_msg_id.clone(),
            text: accumulated.clone(),
            is_done: false,
        });
        sleep(Duration::from_millis(30)).await;
    }

    // Финальный чанк
    let _ = app.emit("chat_stream_chunk", StreamChunk {
        chat_id: chat_id.clone(),
        message_id: assistant_msg_id.clone(),
        text: response_text,
        is_done: true,
    });
}

async fn call_provider_api(
    client: &reqwest::Client,
    provider: &str,
    api_key: &str,
    base_url: Option<&str>,
    model: &str,
    messages: Vec<Value>,
    temperature: f64,
) -> Result<String, String> {
    let mut req_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature
    });

    let (_url, req) = match provider {
        "openai" => {
            let url = "https://api.openai.com/v1/chat/completions";
            let req = client.post(url)
                .bearer_auth(api_key)
                .json(&req_body);
            (url.to_string(), req)
        }
        "openrouter" => {
            let url = "https://openrouter.ai/api/v1/chat/completions";
            let req = client.post(url)
                .bearer_auth(api_key)
                .header("HTTP-Referer", "https://github.com/WorldWiki")
                .header("X-Title", "WorldWiki")
                .json(&req_body);
            (url.to_string(), req)
        }
        "gemini" => {
            // Используем OpenAI-совместимый эндпоинт для простоты интеграции
            let url = "https://generativelanguage.googleapis.com/v1beta/chat/completions";
            // Для Gemini модель должна быть в формате "models/gemini-..."
            let formatted_model = if model.starts_with("models/") {
                model.to_string()
            } else {
                format!("models/{}", model)
            };
            req_body["model"] = serde_json::Value::String(formatted_model);
            let req = client.post(url)
                .header("x-goog-api-key", api_key)
                .json(&req_body);
            (url.to_string(), req)
        }
        "anthropic" => {
            // Для Anthropic формат сообщений немного отличается (system отдельно)
            let mut anthropic_messages = Vec::new();
            let mut system_prompt = None;
            for m in messages {
                let role = m["role"].as_str().unwrap_or("user");
                let content = m["content"].as_str().unwrap_or("");
                if role == "system" {
                    system_prompt = Some(content.to_string());
                } else {
                    anthropic_messages.push(serde_json::json!({
                        "role": role,
                        "content": content
                    }));
                }
            }

            let mut body = serde_json::json!({
                "model": model,
                "messages": anthropic_messages,
                "max_tokens": 4096,
                "temperature": temperature
            });
            if let Some(sys) = system_prompt {
                body["system"] = serde_json::Value::String(sys);
            }

            let url = "https://api.anthropic.com/v1/messages";
            let req = client.post(url)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body);
            (url.to_string(), req)
        }
        "local" => {
            let default_url = "http://localhost:8080/v1/chat/completions";
            let resolved_url = base_url.unwrap_or(default_url);
            let target_url = if resolved_url.ends_with("/chat/completions") {
                resolved_url.to_string()
            } else if resolved_url.ends_with("/v1") {
                format!("{}/chat/completions", resolved_url)
            } else {
                format!("{}/v1/chat/completions", resolved_url)
            };
            let mut req = client.post(&target_url).json(&req_body);
            if !api_key.is_empty() {
                req = req.bearer_auth(api_key);
            }
            (target_url, req)
        }
        _ => return Err(format!("Unsupported provider: {}", provider)),
    };

    let res = req.send().await.map_err(|e| format!("Network error: {}", e))?;
    let status = res.status();
    let response_json: Value = res.json().await.map_err(|e| format!("JSON parse error (Status {}): {}", status, e))?;

    if status.is_success() {
        if provider == "anthropic" {
            // Anthropic возвращает content: [ { type: "text", text: "..." } ]
            let text = response_json["content"][0]["text"].as_str()
                .ok_or_else(|| format!("Invalid Anthropic response structure: {:?}", response_json))?;
            Ok(text.to_string())
        } else {
            // OpenAI / OpenRouter / Gemini / Local возвращают choices[0].message.content
            let text = response_json["choices"][0]["message"]["content"].as_str()
                .ok_or_else(|| format!("Invalid OpenAI response structure: {:?}", response_json))?;
            Ok(text.to_string())
        }
    } else {
        let err_msg = response_json["error"]["message"].as_str()
            .or_else(|| response_json["error"].as_str())
            .unwrap_or("Unknown provider error");
        Err(format!("{} (Status {})", err_msg, status))
    }
}
