use super::text_block::TextBlock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chapter {
    #[serde(default)]
    pub id: String,
    pub volume_id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub word_count: usize,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub blocks: Vec<TextBlock>,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Chapter {
    pub fn new(volume_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        Self {
            id: String::new(),
            volume_id: volume_id.into(),
            title: title.into(),
            content: String::new(),
            word_count: 0,
            sort_order,
            blocks: Vec::new(),
            created_at: default_epoch(),
            updated_at: default_epoch(),
        }
    }

    pub fn update_content(&mut self, new_content: String) {
        self.content = new_content;
        self.word_count = self.content.split_whitespace().count();
    }
}
