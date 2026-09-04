use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use super::status::ManuscriptStatus;
use super::text_block::TextBlock;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub project_id: String,
    pub volume_id: Option<String>,
    pub arc_id: Option<String>,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub word_count: usize,
    pub sort_order: i32,
    pub status: ManuscriptStatus,
    pub timeline_minute: Option<i64>,
    pub blocks: Vec<TextBlock>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Chapter {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            volume_id: None,
            arc_id: None,
            title: title.into(),
            content: String::new(),
            summary: None,
            word_count: 0,
            sort_order,
            status: ManuscriptStatus::Draft,
            timeline_minute: None,
            blocks: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn update_content(&mut self, new_content: String) {
        self.content = new_content;
        self.word_count = self.content.split_whitespace().count();
        self.updated_at = Utc::now();
    }
}
