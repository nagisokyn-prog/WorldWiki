use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Todo {
    #[serde(default)]
    pub id: String,
    pub owner_id: String,
    pub text: String,
    #[serde(default)]
    pub is_done: bool,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Todo {
    pub fn new(owner_id: impl Into<String>, text: impl Into<String>, sort_order: i32) -> Self {
        Self {
            id: String::new(),
            owner_id: owner_id.into(),
            text: text.into(),
            is_done: false,
            sort_order,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn toggle(&mut self) {
        self.is_done = !self.is_done;
        self.updated_at = Utc::now();
    }
}

