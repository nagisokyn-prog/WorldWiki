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
    pub duration_minutes: Option<i64>,
    pub importance: i32,
    pub color: Option<String>,
    pub location_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
            duration_minutes: None,
            importance: 1,
            color: None,
            location_id: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }
}
