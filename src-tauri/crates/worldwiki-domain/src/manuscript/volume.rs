use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use super::status::ManuscriptStatus;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Volume {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub status: ManuscriptStatus,
    pub target_word_count: Option<usize>,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "chrono::Utc::now")]
    pub updated_at: DateTime<Utc>,
}

impl Volume {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            title: title.into(),
            description: None,
            sort_order,
            status: ManuscriptStatus::Draft,
            target_word_count: None,
            created_at: now,
            updated_at: now,
        }
    }
}
