use crate::AppState;
use serde_json::Value;
use surreal_domain::SurrealDb;
use surrealdb::types::RecordId;
use crate::logic::agent_runtime::{run_agent_loop, ActiveSessionsState};
use tauri::Manager;

/// Получает дерево чатов, сгруппированное для UI
#[tauri::command]
pub async fn get_chat_tree(
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();
    let mut response = db
        .query("SELECT * FROM chats WHERE project_id = $proj ORDER BY created_at DESC")
        .bind(("proj", RecordId::new("projects", project_id.as_str())))
        .await
        .map_err(|e| e.to_string())?;
        
    let chats: Vec<Value> = response.take(0).map_err(|e| e.to_string())?;
    Ok(chats)
}

/// Получает плоский массив истории конкретной ветки, поднимаясь вверх по parent_msg_id
#[tauri::command]
pub async fn get_message_branch(
    _leaf_msg_id: String,
    _state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    // Временно возвращаем ошибку нереализованности для сложного графового запроса
    Err("Not implemented yet".to_string())
}

/// Создаёт новую ветку чата от определённого сообщения
#[tauri::command]
pub async fn fork_chat(
    _message_id: String,
    _new_title: String,
    _state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    // Временно
    Err("Not implemented yet".to_string())
}

/// Отправляет сообщение в чат и запускает генерацию ИИ
#[tauri::command]
pub async fn send_chat_message(
    chat_id: String,
    text: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("[API] send_chat_message called: chat_id={}, text={}", chat_id, text);
    
    // 1. Создать пользовательское сообщение в БД
    // (пока пропускаем для заглушки)
    
    // 2. Сгенерировать ID для будущего сообщения ассистента
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    
    // 3. Запустить фоновый цикл агента
    let chat_id_clone = chat_id.clone();
    let assistant_msg_id_clone = assistant_msg_id.clone();
    
    tokio::spawn(async move {
        run_agent_loop(app, chat_id_clone, assistant_msg_id_clone, text).await;
    });
    
    // 4. Вернуть ID пустого сообщения, чтобы Vue сразу отрисовал его
    Ok(assistant_msg_id)
}

/// Одобряет или отклоняет вызов инструмента ИИ
#[tauri::command]
pub async fn approve_tool_call(
    chat_id: String,
    tool_call_id: String,
    approved: bool,
    app: tauri::AppHandle,
) -> Result<(), String> {
    println!("[API] approve_tool_call called: chat_id={}, tool={}, approved={}", chat_id, tool_call_id, approved);
    let state = app.state::<ActiveSessionsState>();
    
    if let Some((_, sender)) = state.tool_approvals.remove(&chat_id) {
        let _ = sender.send(approved);
        Ok(())
    } else {
        Err("No active tool call waiting for approval for this chat".to_string())
    }
}

