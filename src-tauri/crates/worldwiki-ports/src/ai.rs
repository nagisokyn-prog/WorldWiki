use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::ai::{Chat, ChatMessage, AiProfile, AiModelInfo};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InferenceRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<usize>,
    pub tools: Option<Vec<Value>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InferenceResponse {
    pub text: String,
    pub tool_calls: Option<Vec<Value>>,
    pub usage: Option<Value>,
}

#[async_trait]
pub trait LlmInferencePort: Send + Sync {
    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, DomainError>;
}

#[async_trait]
pub trait EmbeddingPort: Send + Sync {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, DomainError>;
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, DomainError>;
}

#[async_trait]
pub trait RAGContextPort: Send + Sync {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, DomainError>;

    async fn retrieve_chapter_multi_hop_context(
        &self,
        project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError>;
}

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
}

#[async_trait]
pub trait AiProfileRepository: Send + Sync {
    async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, DomainError>;
    async fn get_active_profile(&self, project_id: &str) -> Result<Option<AiProfile>, DomainError>;
    async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, DomainError>;
    async fn delete_profile(&self, id: &str) -> Result<(), DomainError>;
    async fn fetch_models(&self, provider: &str, api_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError>;
}
