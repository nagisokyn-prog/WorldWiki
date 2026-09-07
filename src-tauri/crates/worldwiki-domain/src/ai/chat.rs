use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub tag: Option<String>,
    pub parent_chat_id: Option<String>,
    pub session_context: Vec<String>,
    pub token_usage: Option<TokenUsage>,
    pub created_at: Option<String>,
}

impl Chat {
    pub fn new(id: impl Into<String>, project_id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            project_id: project_id.into(),
            title: title.into(),
            tag: None,
            parent_chat_id: None,
            session_context: Vec::new(),
            token_usage: None,
            created_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub project_id: String,
    pub chat_id: String,
    pub role: MessageRole,
    pub content: String,
    pub reasoning: Option<String>,
    pub tool_logs: Option<Vec<String>>,
    pub version: u32,
    pub parent_id: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl ChatMessage {
    pub fn new(
        id: impl Into<String>,
        project_id: impl Into<String>,
        chat_id: impl Into<String>,
        role: MessageRole,
        content: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            project_id: project_id.into(),
            chat_id: chat_id.into(),
            role,
            content: content.into(),
            reasoning: None,
            tool_logs: None,
            version: 1,
            parent_id: None,
            is_active: true,
            created_at: None,
            updated_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProfile {
    pub id: Option<String>,
    pub project_id: String,
    pub name: String,
    pub provider: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub settings: serde_json::Value,
    pub is_active: bool,
    pub is_global: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiModelInfo {
    pub value: String,
    pub label: String,
    pub description: Option<String>,
    pub context_length: Option<u64>,
    pub max_completion_tokens: Option<u64>,
}
