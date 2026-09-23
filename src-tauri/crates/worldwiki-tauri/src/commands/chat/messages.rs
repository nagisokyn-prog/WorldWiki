use serde::{Deserialize, Serialize};
use tauri::State;
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

    let _agent_task = tokio::spawn(async move {
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
pub async fn cancel_generation(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<(), IpcError> {
    state.services.chat.abort_generation(&chat_id);
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

    let _agent_task = tokio::spawn(async move {
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
    let (c_id, a_id, u_text) = state
        .services
        .chat
        .regenerate_message(&project, &chat_id, &parent_msg_id)
        .await
        .map_err(IpcError::from)?;

    let chat_svc = state.services.chat.clone();
    let p_id = project.clone();

    let _agent_task = tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&p_id, &c_id, &a_id, &u_text, mode_slug)
            .await;
    });

    Ok(())
}
