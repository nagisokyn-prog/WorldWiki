use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::ai::AiProfile;
use worldwiki_domain::errors::DomainError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolUseCall {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamEventDto {
    pub text_delta: Option<String>,
    pub reasoning_delta: Option<String>,
    pub tool_use: Option<ToolUseCall>,
    pub usage: Option<Value>,
    pub is_done: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamRequest {
    pub profile: AiProfile,
    pub system_prompt: String,
    pub messages: Vec<Value>,
    pub tools: Option<Vec<Value>>,
}

#[async_trait]
pub trait LlmStreamPort: Send + Sync {
    async fn stream_chat(
        &self,
        request: StreamRequest,
        sender: tokio::sync::mpsc::Sender<StreamEventDto>,
    ) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ToolExecutorPort: Send + Sync {
    async fn execute_tool(
        &self,
        call_id: &str,
        tool_name: &str,
        input: Value,
        project_id: &str,
    ) -> Result<Value, DomainError>;
}
