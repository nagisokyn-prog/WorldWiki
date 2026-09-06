use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use super::status::ManuscriptStatus;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Arc {
    pub id: String,
    pub project_id: String,
    pub volume_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub status: ManuscriptStatus,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "chrono::Utc::now")]
    pub updated_at: DateTime<Utc>,
}

impl Arc {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            volume_id: None,
            title: title.into(),
            description: None,
            sort_order,
            status: ManuscriptStatus::Draft,
            created_at: now,
            updated_at: now,
        }
    }
}
