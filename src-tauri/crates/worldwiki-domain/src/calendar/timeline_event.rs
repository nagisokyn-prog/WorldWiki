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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub m_abs_end: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date_precision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_approximate: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_of_day: Option<String>,
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
            m_abs_end: None,
            date_precision: None,
            is_approximate: None,
            time_of_day: None,
            created_at: DateTime::UNIX_EPOCH,
        }
    }
}
