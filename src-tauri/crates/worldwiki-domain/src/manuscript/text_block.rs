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

    /// Strictly extracts ((Entity)) mentions and HTML entity links per domain invariant
    pub fn extract_entity_mentions(text: &str) -> Vec<String> {
        let mut results = Vec::new();

        // 1. Extract ((Entity)) mentions
        let mut remaining = text;
        while let Some((_, after_open)) = remaining.split_once("((") {
            if let Some((entity_name_raw, after_close)) = after_open.split_once("))") {
                let clean = Self::clean_entity_mention(entity_name_raw);
                if !clean.is_empty() && !results.contains(&clean) {
                    results.push(clean);
                }
                remaining = after_close;
            } else {
                break;
            }
        }

        // 2. Extract <a ...>Entity Name</a> mentions from HTML
        let mut remaining_html = text;
        while let Some((_, after_a_open)) = remaining_html.split_once("<a ") {
            if let Some((tag_and_body, after_a_close)) = after_a_open.split_once("</a>") {
                if let Some((_, text_inside)) = tag_and_body.split_once('>') {
                    let clean = Self::clean_entity_mention(text_inside);
                    if !clean.is_empty() && !results.contains(&clean) {
                        results.push(clean);
                    }
                }
                remaining_html = after_a_close;
            } else {
                break;
            }
        }

        results
    }

    fn clean_entity_mention(raw: &str) -> String {
        let mut clean = String::with_capacity(raw.len());
        let mut in_tag = false;
        for c in raw.chars() {
            if c == '<' {
                in_tag = true;
            } else if c == '>' {
                in_tag = false;
            } else if !in_tag {
                clean.push(c);
            }
        }
        clean.trim().to_string()
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
    fn test_extract_entity_mentions_html_and_markdown() {
        let text = "<p>Появилась <a href=\"/ui_editor.html?type=character&id=entities:123\">Вероника</a> и ((Катя))[ui_editor.html] вместе с <span>((Кира))</span>.</p>";
        let mentions = TextBlock::extract_entity_mentions(text);
        assert_eq!(mentions, vec!["Катя", "Кира", "Вероника"]);
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
