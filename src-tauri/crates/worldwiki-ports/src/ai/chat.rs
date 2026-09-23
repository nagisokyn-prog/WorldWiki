use async_trait::async_trait;
use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage};
use worldwiki_domain::errors::DomainError;

#[async_trait]
pub trait ChatRepository: Send + Sync {
    async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, DomainError>;
    async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, DomainError>;
    async fn save_chat(&self, chat: &Chat) -> Result<Chat, DomainError>;
    async fn save_message(&self, message: &ChatMessage) -> Result<ChatMessage, DomainError>;
    async fn delete_chat(&self, chat_id: &str) -> Result<(), DomainError>;
    async fn delete_message(&self, message_id: &str) -> Result<(), DomainError>;
    async fn update_chat_parent(&self, chat_id: &str, new_parent_id: Option<&str>) -> Result<(), DomainError>;
    async fn switch_variant(&self, message_id: &str) -> Result<(), DomainError>;
    async fn update_token_usage(&self, chat_id: &str, usage: &worldwiki_domain::ai::TokenUsage) -> Result<(), DomainError>;
    async fn edit_message_branch(&self, project_id: &str, chat_id: &str, msg_id: &str, new_text: &str) -> Result<(String, String), DomainError>;
    async fn regenerate_assistant_variant(&self, project_id: &str, chat_id: &str, parent_msg_id: &str) -> Result<(String, String, String), DomainError>;
}

#[async_trait]
pub trait AiProfileRepository: Send + Sync {
    async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, DomainError>;
    async fn get_active_profile(&self, project_id: &str) -> Result<Option<AiProfile>, DomainError>;
    async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, DomainError>;
    async fn delete_profile(&self, id: &str) -> Result<(), DomainError>;
    async fn fetch_models(&self, provider: &str, api_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError>;
}
