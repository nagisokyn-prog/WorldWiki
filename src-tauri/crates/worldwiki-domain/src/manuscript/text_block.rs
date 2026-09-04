use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextBlock {
    pub id: String,
    pub chapter_id: String,
    pub block_type: String, // paragraph, heading, quote, dialogue
    pub content: String,
    pub order_index: i32,
    #[serde(default)]
    pub mentioned_entities: Vec<String>,
}

impl TextBlock {
    pub fn new(chapter_id: impl Into<String>, block_type: impl Into<String>, content: impl Into<String>, order_index: i32) -> Self {
        let content_str = content.into();
        let mentions = Self::extract_entity_mentions(&content_str);
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            chapter_id: chapter_id.into(),
            block_type: block_type.into(),
            content: content_str,
            order_index,
            mentioned_entities: mentions,
        }
    }

    /// Strictly extracts ((Entity)) mentions per domain invariant
    pub fn extract_entity_mentions(text: &str) -> Vec<String> {
        let mut results = Vec::new();
        let mut start = 0;
        while let Some(open) = text[start..].find("((") {
            let actual_open = start + open + 2;
            if let Some(close) = text[actual_open..].find("))") {
                let entity_name = text[actual_open..actual_open + close].trim();
                if !entity_name.is_empty() && !results.contains(&entity_name.to_string()) {
                    results.push(entity_name.to_string());
                }
                start = actual_open + close + 2;
            } else {
                break;
            }
        }
        results
    }
}
