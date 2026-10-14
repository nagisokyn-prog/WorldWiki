use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanParentType {
    Volume,
    Chapter,
    Plan,
}

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    #[serde(default)]
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub parent_ref: Option<String>,
    pub parent_type: PlanParentType,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub completed: bool,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Plan {
    pub fn new(
        project_id: impl Into<String>,
        title: impl Into<String>,
        parent_type: PlanParentType,
        parent_ref: Option<String>,
        sort_order: i32,
    ) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            title: title.into(),
            parent_ref,
            parent_type,
            sort_order,
            completed: false,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }

    pub fn complete(&mut self) {
        self.completed = true;
    }
}
