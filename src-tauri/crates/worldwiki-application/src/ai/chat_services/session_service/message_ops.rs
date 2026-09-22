use super::types::SendMessageResult;
use std::sync::Arc;
use worldwiki_domain::ai::{ChatMessage, MessageRole};
use worldwiki_ports::ai::ChatRepository;
use crate::errors::ApplicationError;

pub async fn get_messages(
    chat_repo: &Arc<dyn ChatRepository>,
    chat_id: &str,
) -> Result<Vec<ChatMessage>, ApplicationError> {
    chat_repo
        .get_messages(chat_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn send_message(
    chat_repo: &Arc<dyn ChatRepository>,
    project_id: &str,
    chat_id: &str,
    text: &str,
) -> Result<SendMessageResult, ApplicationError> {
    let is_new = chat_id.is_empty() || chat_id == "new" || !chat_id.starts_with("chats:");
    let actual_chat_id = if is_new {
        let new_uuid = uuid::Uuid::new_v4().to_string();
        let c_id = format!("chats:{new_uuid}");
        let title: String = text.chars().take(40).collect();
        let title = if title.trim().is_empty() {
            "Новый чат".to_string()
        } else {
            title
        };

        let chat = worldwiki_domain::ai::Chat::new(c_id.clone(), project_id, title);
        chat_repo
            .save_chat(&chat)
            .await
            .map_err(ApplicationError::from)?;
        c_id
    } else {
        chat_id.to_string()
    };

    let existing_messages = chat_repo
        .get_messages(&actual_chat_id)
        .await
        .unwrap_or_default();

    let last_msg_id = existing_messages.last().map(|m| m.id.clone());

    let user_uuid = uuid::Uuid::new_v4().to_string();
    let user_msg_id = format!("chat_messages:{user_uuid}");
    let mut user_msg = ChatMessage::new(
        user_msg_id.clone(),
        project_id,
        actual_chat_id.clone(),
        MessageRole::User,
        text,
    );
    user_msg.parent_id = last_msg_id;

    chat_repo
        .save_message(&user_msg)
        .await
        .map_err(ApplicationError::from)?;

    let asst_uuid = uuid::Uuid::new_v4().to_string();
    let asst_msg_id = format!("chat_messages:{asst_uuid}");
    let mut asst_msg = ChatMessage::new(
        asst_msg_id.clone(),
        project_id,
        actual_chat_id.clone(),
        MessageRole::Assistant,
        "",
    );
    asst_msg.parent_id = Some(user_msg_id.clone());

    chat_repo
        .save_message(&asst_msg)
        .await
        .map_err(ApplicationError::from)?;

    Ok(SendMessageResult {
        chat_id: actual_chat_id,
        user_msg_id,
        assistant_msg_id: asst_msg_id,
    })
}

pub async fn delete_message(
    chat_repo: &Arc<dyn ChatRepository>,
    message_id: &str,
) -> Result<(), ApplicationError> {
    chat_repo
        .delete_message(message_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn switch_variant(
    chat_repo: &Arc<dyn ChatRepository>,
    message_id: &str,
) -> Result<(), ApplicationError> {
    chat_repo
        .switch_variant(message_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn edit_message(
    chat_repo: &Arc<dyn ChatRepository>,
    project_id: &str,
    chat_id: &str,
    msg_id: &str,
    new_text: &str,
) -> Result<(String, String), ApplicationError> {
    chat_repo
        .edit_message_branch(project_id, chat_id, msg_id, new_text)
        .await
        .map_err(ApplicationError::from)
}

pub async fn regenerate_message(
    chat_repo: &Arc<dyn ChatRepository>,
    project_id: &str,
    chat_id: &str,
    parent_msg_id: &str,
) -> Result<(String, String, String), ApplicationError> {
    chat_repo
        .regenerate_assistant_variant(project_id, chat_id, parent_msg_id)
        .await
        .map_err(ApplicationError::from)
}
