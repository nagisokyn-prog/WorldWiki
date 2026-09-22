use tauri::State;
use worldwiki_domain::ai::{Chat, ChatMessage};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_chat_tree(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Chat>, IpcError> {
    state
        .services
        .chat
        .get_chat_tree(&project_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_chat_messages(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Vec<ChatMessage>, IpcError> {
    state
        .services
        .chat
        .get_messages(&chat_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_message_branch(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Vec<ChatMessage>, IpcError> {
    state
        .services
        .chat
        .get_messages(&chat_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn fork_chat(
    state: State<'_, AppState>,
    project_id: String,
    message_id: String,
    new_title: String,
) -> Result<Chat, IpcError> {
    state
        .services
        .chat
        .fork_chat(&project_id, &message_id, &new_title)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_chat(
    state: State<'_, AppState>,
    data: Chat,
) -> Result<Chat, IpcError> {
    state
        .services
        .chat
        .save_chat(&data)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn update_chat_parent(
    state: State<'_, AppState>,
    chat_id: String,
    new_parent_id: Option<String>,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .update_chat_parent(&chat_id, new_parent_id.as_deref())
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_ai_chat(
    state: State<'_, AppState>,
    _project: String,
    id: String,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .delete_chat(&id)
        .await
        .map_err(IpcError::from)
}
