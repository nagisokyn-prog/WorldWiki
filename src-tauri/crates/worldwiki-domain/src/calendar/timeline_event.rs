use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: String,
    pub project_id: String,
    pub calendar_id: String,
    pub title: String,
    pub description: Option<String>,
    pub m_abs: i64,
    pub created_at: DateTime<Utc>,
}

impl TimelineEvent {
    pub fn new(
        project_id: impl Into<String>,
        calendar_id: impl Into<String>,
        title: impl Into<String>,
        m_abs: i64,
    ) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            calendar_id: calendar_id.into(),
            title: title.into(),
            description: None,
            m_abs,
            created_at: DateTime::UNIX_EPOCH,
        }
    }
}
