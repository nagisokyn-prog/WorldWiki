use serde::{Deserialize, Serialize};
use tauri::State;
use crate::error::IpcError;
use crate::bridge_command;
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
    let c_id = res.chat_id.clone();
    let a_id = res.assistant_msg_id.clone();

    let _agent_task = tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&project, &c_id, &a_id, &text, mode_slug)
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

bridge_command!(
    delete_chat_message(msg_id: String) -> Result<(), IpcError>
        => chat.delete_message(&msg_id)
);

bridge_command!(
    switch_message_variant(msg_id: String) -> Result<(), IpcError>
        => chat.switch_variant(&msg_id)
);

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

    let _agent_task = tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&project, &c_id, &a_id, &new_text, mode_slug)
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

    let _agent_task = tokio::spawn(async move {
        chat_svc
            .run_agent_loop(&project, &c_id, &a_id, &u_text, mode_slug)
            .await;
    });

    Ok(())
}
