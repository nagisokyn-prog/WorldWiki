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
    pub fn new(
        chapter_id: impl Into<String>,
        block_type: impl Into<String>,
        content: impl Into<String>,
        order_index: i32,
    ) -> Self {
        let content_str = content.into();
        let mentions = Self::extract_entity_mentions(&content_str);
        Self {
            id: String::new(),
            chapter_id: chapter_id.into(),
            block_type: block_type.into(),
            content: content_str,
            order_index,
            mentioned_entities: mentions,
        }
    }

    /// Strictly extracts ((Entity)) mentions per domain invariant with bounds-checked parsing
    pub fn extract_entity_mentions(text: &str) -> Vec<String> {
        let mut results = Vec::new();
        let mut remaining = text;
        while let Some((_, after_open)) = remaining.split_once("((") {
            if let Some((entity_name_raw, after_close)) = after_open.split_once("))") {
                let entity_name = entity_name_raw.trim();
                if !entity_name.is_empty() && !results.contains(&entity_name.to_string()) {
                    results.push(entity_name.to_string());
                }
                remaining = after_close;
            } else {
                break;
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_entity_mentions_basic_and_utf8() {
        let text = "Встретились ((Королёв)) и ((Гагарин, Юрий)), обсудили ((Восток-1)).";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert_eq!(mentions, vec!["Королёв", "Гагарин, Юрий", "Восток-1"]);
    }

    #[test]
    fn test_extract_entity_mentions_duplicates_and_empty() {
        let text = "((Королёв)) вернулся к ((Королёв)) и (()) и ((   )).";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert_eq!(mentions, vec!["Королёв"]);
    }

    #[test]
    fn test_text_block_constructor() {
        let block = TextBlock::new("ch_1", "paragraph", "Текст с ((Сущность))", 1);
        assert_eq!(block.chapter_id, "ch_1");
        assert_eq!(block.block_type, "paragraph");
        assert_eq!(block.order_index, 1);
        assert_eq!(block.mentioned_entities, vec!["Сущность"]);
    }
}
