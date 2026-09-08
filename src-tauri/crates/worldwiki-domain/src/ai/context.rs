use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSource {
    ConversationLineage,
    ExplicitReference,
    CrossChatMemory,
    ProjectEntityRag,
    WebEvidence,
    ToolResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextItem {
    pub source: ContextSource,
    pub source_id: Option<String>,
    pub tokens: usize,
    pub priority: usize, // 1 (критический/гарантированный) .. 4 (низкий/сжимаемый)
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextBundle {
    pub items: Vec<ContextItem>,
    pub total_tokens: usize,
    pub budget_limit: usize,
}

impl ContextBundle {
    pub fn new(budget_limit: usize) -> Self {
        Self {
            items: Vec::new(),
            total_tokens: 0,
            budget_limit,
        }
    }

    pub fn add_item(&mut self, item: ContextItem) {
        self.total_tokens += item.tokens;
        self.items.push(item);
    }
}
