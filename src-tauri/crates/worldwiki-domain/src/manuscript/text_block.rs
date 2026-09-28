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

    pub fn extract_entity_mentions(text: &str) -> Vec<String> {
        crate::manuscript::MentionParser::extract_entity_mentions(text)
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
    fn test_extract_entity_mentions_with_record_ids_and_urls() {
        let text = "((Лёша))[id=entities%3A7w21sa785q6u47gguwbs] встретил ((Вероника))[entities:rycese8g98bwep68rib6].";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert!(mentions.contains(&"entities:7w21sa785q6u47gguwbs".to_string()));
        assert!(mentions.contains(&"Лёша".to_string()));
        assert!(mentions.contains(&"entities:rycese8g98bwep68rib6".to_string()));
        assert!(mentions.contains(&"Вероника".to_string()));
    }

    #[test]
    fn test_extract_entity_mentions_html_and_markdown() {
        let text = "<p>Появилась <a href=\"/ui_editor.html?type=character&id=entities%3A123\">Вероника</a> и ((Катя))[ui_editor.html] вместе с <span class=\"entity-mention\" data-entity-id=\"entities:456\">((Кира))</span>.</p>";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert!(mentions.contains(&"entities:123".to_string()));
        assert!(mentions.contains(&"Вероника".to_string()));
        assert!(mentions.contains(&"Катя".to_string()));
        assert!(mentions.contains(&"entities:456".to_string()));
        assert!(mentions.contains(&"Кира".to_string()));
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
