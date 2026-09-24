use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventReveal {
    pub id: String,
    pub event_id: String,
    pub chapter_id: String,
    pub pov_id: Option<String>,
    pub kind: String, // 'direct' | 'flashback' | 'mention' | 'rumor'
    pub block_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl EventReveal {
    pub fn new(
        event_id: impl Into<String>,
        chapter_id: impl Into<String>,
        kind: impl Into<String>,
    ) -> Self {
        Self {
            id: String::new(),
            event_id: event_id.into(),
            chapter_id: chapter_id.into(),
            pov_id: None,
            kind: kind.into(),
            block_id: None,
            created_at: DateTime::UNIX_EPOCH,
        }
    }
}
