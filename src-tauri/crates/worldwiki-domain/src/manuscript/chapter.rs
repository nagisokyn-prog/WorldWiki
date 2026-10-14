use super::status::ManuscriptStatus;
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
    pub project_id: String,
    pub volume_id: Option<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub content: String,
    pub summary: Option<String>,
    #[serde(default)]
    pub word_count: usize,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub status: ManuscriptStatus,
    pub timeline_minute: Option<i64>,
    #[serde(default)]
    pub blocks: Vec<TextBlock>,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Chapter {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            volume_id: None,
            title: title.into(),
            content: String::new(),
            summary: None,
            word_count: 0,
            sort_order,
            status: ManuscriptStatus::Draft,
            timeline_minute: None,
            blocks: Vec::new(),
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }

    pub fn update_content(&mut self, new_content: String) {
        self.content = new_content;
        self.word_count = self.content.split_whitespace().count();
    }
}
