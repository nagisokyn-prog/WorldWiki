pub mod message_ops;
pub mod profile_ops;
pub mod session_ops;
pub(crate) mod types;

pub use types::SendMessageResult;

use std::sync::Arc;
use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage};
use worldwiki_ports::ai::{AiProfileRepository, ChatRepository};
use crate::errors::ApplicationError;

pub struct ChatSessionService;

impl ChatSessionService {
    pub async fn get_chat_tree(
        chat_repo: &Arc<dyn ChatRepository>,
        project_id: &str,
    ) -> Result<Vec<Chat>, ApplicationError> {
        session_ops::get_chat_tree(chat_repo, project_id).await
    }

    pub async fn get_messages(
        chat_repo: &Arc<dyn ChatRepository>,
        chat_id: &str,
    ) -> Result<Vec<ChatMessage>, ApplicationError> {
        message_ops::get_messages(chat_repo, chat_id).await
    }

    pub async fn send_message(
        chat_repo: &Arc<dyn ChatRepository>,
        project_id: &str,
        chat_id: &str,
        text: &str,
    ) -> Result<SendMessageResult, ApplicationError> {
        message_ops::send_message(chat_repo, project_id, chat_id, text).await
    }

    pub async fn fork_chat(
        chat_repo: &Arc<dyn ChatRepository>,
        project_id: &str,
        message_id: &str,
        new_title: &str,
    ) -> Result<Chat, ApplicationError> {
        session_ops::fork_chat(chat_repo, project_id, message_id, new_title).await
    }

    pub async fn save_chat(
        chat_repo: &Arc<dyn ChatRepository>,
        chat: &Chat,
    ) -> Result<Chat, ApplicationError> {
        session_ops::save_chat(chat_repo, chat).await
    }

    pub async fn update_chat_parent(
        chat_repo: &Arc<dyn ChatRepository>,
        chat_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<(), ApplicationError> {
        session_ops::update_chat_parent(chat_repo, chat_id, new_parent_id).await
    }

    pub async fn delete_chat(
        chat_repo: &Arc<dyn ChatRepository>,
        chat_id: &str,
    ) -> Result<(), ApplicationError> {
        session_ops::delete_chat(chat_repo, chat_id).await
    }

    pub async fn delete_message(
        chat_repo: &Arc<dyn ChatRepository>,
        message_id: &str,
    ) -> Result<(), ApplicationError> {
        message_ops::delete_message(chat_repo, message_id).await
    }

    pub async fn switch_variant(
        chat_repo: &Arc<dyn ChatRepository>,
        message_id: &str,
    ) -> Result<(), ApplicationError> {
        message_ops::switch_variant(chat_repo, message_id).await
    }

    pub async fn edit_message(
        chat_repo: &Arc<dyn ChatRepository>,
        project_id: &str,
        chat_id: &str,
        msg_id: &str,
        new_text: &str,
    ) -> Result<(String, String), ApplicationError> {
        message_ops::edit_message(chat_repo, project_id, chat_id, msg_id, new_text).await
    }

    pub async fn regenerate_message(
        chat_repo: &Arc<dyn ChatRepository>,
        project_id: &str,
        chat_id: &str,
        parent_msg_id: &str,
    ) -> Result<(String, String, String), ApplicationError> {
        message_ops::regenerate_message(chat_repo, project_id, chat_id, parent_msg_id).await
    }

    pub async fn fetch_models(
        profile_repo: &Arc<dyn AiProfileRepository>,
        provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<AiModelInfo>, ApplicationError> {
        profile_ops::fetch_models(profile_repo, provider, api_key).await
    }

    pub async fn get_profiles(
        profile_repo: &Arc<dyn AiProfileRepository>,
        project_id: &str,
    ) -> Result<Vec<AiProfile>, ApplicationError> {
        profile_ops::get_profiles(profile_repo, project_id).await
    }

    pub async fn save_profile(
        profile_repo: &Arc<dyn AiProfileRepository>,
        profile: &AiProfile,
    ) -> Result<AiProfile, ApplicationError> {
        profile_ops::save_profile(profile_repo, profile).await
    }

    pub async fn delete_profile(
        profile_repo: &Arc<dyn AiProfileRepository>,
        id: &str,
    ) -> Result<(), ApplicationError> {
        profile_ops::delete_profile(profile_repo, id).await
    }
}
