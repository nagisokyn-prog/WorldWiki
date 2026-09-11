use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanParentType {
    Volume,
    Chapter,
    Plan,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub parent_ref: Option<String>,
    pub parent_type: PlanParentType,
    pub sort_order: i32,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
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
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            title: title.into(),
            parent_ref,
            parent_type,
            sort_order,
            completed: false,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn complete(&mut self) {
        self.completed = true;
        self.updated_at = Utc::now();
    }
}
