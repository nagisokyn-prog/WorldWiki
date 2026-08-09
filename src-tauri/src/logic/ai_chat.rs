use crate::AppState;
use serde_json::Value;
use surreal_domain::SurrealDb;
use surrealdb::types::RecordId;

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
