use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;

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
}
