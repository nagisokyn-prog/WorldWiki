use dashmap::DashMap;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::oneshot;
use tokio::time::{sleep, Duration};

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
    chat_id: String,
    assistant_msg_id: String,
    _user_text: String,
) {
    println!("[AGENT] Started loop for chat: {}", chat_id);
    
    // В БОЕВОМ РЕЖИМЕ: здесь мы обращаемся к SurrealDB через `app.state::<AppState>()`, 
    // достаём всю историю сообщений, формируем промпт и отправляем в claw_api / llama_sys.
    
    // Симуляция потоковой генерации ответа от LLM
    let chunks = vec![
        "Привет! ",
        "Я проанализировал ",
        "ваш запрос. ",
        "Сейчас выполню поиск ",
        "по базе данных...",
    ];

    for chunk in chunks {
        sleep(Duration::from_millis(200)).await;
        
        let payload = StreamChunk {
            chat_id: chat_id.clone(),
            message_id: assistant_msg_id.clone(),
            text: chunk.to_string(),
            is_done: false,
        };
        
        let _ = app.emit("chat_stream_chunk", payload);
    }
    
    // Симуляция вызова инструмента (Tool Call)
    sleep(Duration::from_millis(500)).await;
    let tool_call_id = uuid::Uuid::new_v4().to_string();
    
    let tool_req = ToolCallRequest {
        chat_id: chat_id.clone(),
        tool_name: "search_entities".to_string(),
        tool_args: serde_json::json!({ "query": "Магия" }),
        tool_call_id: tool_call_id.clone(),
    };
    
    println!("[AGENT] Emitting tool_call_requested...");
    let _ = app.emit("tool_call_requested", tool_req);
    
    // Ждём разрешения от пользователя
    let (tx, rx) = oneshot::channel();
    {
        let state = app.state::<ActiveSessionsState>();
        state.tool_approvals.insert(chat_id.clone(), tx);
    }
    
    println!("[AGENT] Waiting for tool approval...");
    match rx.await {
        Ok(true) => {
            println!("[AGENT] Tool approved! Executing...");
            // В БОЕВОМ РЕЖИМЕ: выполняем логику инструмента, добавляем результат в контекст
            // и снова обращаемся к LLM для продолжения генерации.
            
            sleep(Duration::from_millis(500)).await;
            let _ = app.emit("chat_stream_chunk", StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text: "\n\nЯ нашёл несколько сущностей, связанных с магией. Что именно вас интересует?".to_string(),
                is_done: true,
            });
        }
        Ok(false) => {
            println!("[AGENT] Tool denied!");
            let _ = app.emit("chat_stream_chunk", StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text: "\n\nДействие было отменено.".to_string(),
                is_done: true,
            });
        }
        Err(_) => {
            println!("[AGENT] Channel closed / aborted.");
        }
    }
    
    println!("[AGENT] Loop finished.");
}
