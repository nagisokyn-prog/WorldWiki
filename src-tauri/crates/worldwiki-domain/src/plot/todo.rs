use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum TodoStatus {
    #[default]
    Planned,    // «В планах» ⚪
    InProgress, // «В работе» 🟡
    Done,       // «Готово» 🟢
    Blocked,    // «Ожидает» 🔒
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Todo {
    #[serde(default)]
    pub id: String,
    pub owner_id: String,
    #[serde(default)]
    pub arc_id: Option<String>,
    #[serde(default)]
    pub arc_title: Option<String>,
    #[serde(default)]
    pub depends_on: Option<String>,
    pub text: String,
    #[serde(default)]
    pub status: TodoStatus,
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
            arc_id: None,
            arc_title: None,
            depends_on: None,
            text: text.into(),
            status: TodoStatus::Planned,
            is_done: false,
            sort_order,
            created_at: default_epoch(),
            updated_at: default_epoch(),
        }
    }

    pub fn with_arc(mut self, arc_id: impl Into<String>) -> Self {
        self.arc_id = Some(arc_id.into());
        self
    }

    pub fn with_depends_on(mut self, depends_on: impl Into<String>) -> Self {
        self.depends_on = Some(depends_on.into());
        self.status = TodoStatus::Blocked;
        self
    }

    pub fn toggle(&mut self) {
        if self.status == TodoStatus::Done {
            self.status = TodoStatus::Planned;
            self.is_done = false;
        } else {
            self.status = TodoStatus::Done;
            self.is_done = true;
        }
    }

    pub fn set_status(&mut self, status: TodoStatus) {
        self.status = status;
        self.is_done = status == TodoStatus::Done;
    }
}

