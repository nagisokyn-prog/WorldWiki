use serde::{Deserialize, Serialize};
use tauri::State;
use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage};
use crate::error::IpcError;
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct SendChatResult {
    pub chat_id: String,
    pub user_msg_id: String,
    pub assistant_msg_id: String,
}

#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, AppState>,
    chat_id: String,
    text: String,
    project: String,
    mode_slug: Option<String>,
) -> Result<SendChatResult, IpcError> {
    let res = state
        .services
        .chat
        .send_message(&project, &chat_id, &text)
        .await
        .map_err(IpcError::from)?;

    let chat_svc = state.services.chat.clone();
    let p_id = project.clone();
    let c_id = res.chat_id.clone();
    let a_id = res.assistant_msg_id.clone();
    let u_text = text.clone();

    tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&p_id, &c_id, &a_id, &u_text, mode_slug)
            .await;
    });

    Ok(SendChatResult {
        chat_id: res.chat_id,
        user_msg_id: res.user_msg_id,
        assistant_msg_id: res.assistant_msg_id,
    })
}

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
pub async fn cancel_generation(
    _state: State<'_, AppState>,
    _chat_id: String,
) -> Result<(), IpcError> {
    Ok(())
}

#[tauri::command]
pub async fn delete_chat_message(
    state: State<'_, AppState>,
    msg_id: String,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .delete_message(&msg_id)
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

#[tauri::command]
pub async fn switch_message_variant(
    state: State<'_, AppState>,
    msg_id: String,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .switch_variant(&msg_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn fetch_ai_models(
    state: State<'_, AppState>,
    provider: String,
    api_key: Option<String>,
) -> Result<Vec<AiModelInfo>, IpcError> {
    state
        .services
        .chat
        .fetch_models(&provider, api_key.as_deref())
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_aiprofiles(
    state: State<'_, AppState>,
    project: String,
) -> Result<Vec<AiProfile>, IpcError> {
    state
        .services
        .chat
        .get_profiles(&project)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_aiprofile(
    state: State<'_, AppState>,
    data: AiProfile,
) -> Result<AiProfile, IpcError> {
    state
        .services
        .chat
        .save_profile(&data)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_aiprofile(
    state: State<'_, AppState>,
    _project: String,
    id: String,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .delete_profile(&id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn edit_chat_message(
    state: State<'_, AppState>,
    msg_id: String,
    new_text: String,
    chat_id: String,
    project: String,
    mode_slug: Option<String>,
) -> Result<(), IpcError> {
    let (c_id, a_id) = state
        .services
        .chat
        .edit_message(&project, &chat_id, &msg_id, &new_text)
        .await
        .map_err(IpcError::from)?;

    let chat_svc = state.services.chat.clone();
    let p_id = project.clone();
    let u_text = new_text.clone();

    tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&p_id, &c_id, &a_id, &u_text, mode_slug)
            .await;
    });

    Ok(())
}

#[tauri::command]
pub async fn regenerate_chat_message(
    state: State<'_, AppState>,
    parent_msg_id: String,
    chat_id: String,
    project: String,
    mode_slug: Option<String>,
) -> Result<(), IpcError> {
    let (c_id, a_id) = state
        .services
        .chat
        .regenerate_message(&project, &chat_id, &parent_msg_id)
        .await
        .map_err(IpcError::from)?;

    let chat_svc = state.services.chat.clone();
    let p_id = project.clone();

    tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&p_id, &c_id, &a_id, "", mode_slug)
            .await;
    });

    Ok(())
}
