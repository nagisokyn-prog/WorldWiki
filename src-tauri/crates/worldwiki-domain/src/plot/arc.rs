use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ArcType {
    #[default]
    Character,
    Event,
    Relationship,
    Theme,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ArcStatus {
    #[default]
    Planned,
    InProgress,
    Completed,
    Abandoned,
}

fn default_datetime() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StoryArc {
    #[serde(default)]
    pub id: String,
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub status: ArcStatus,
    #[serde(default = "default_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_datetime")]
    pub updated_at: DateTime<Utc>,
}

impl StoryArc {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            title: title.into(),
            status: ArcStatus::InProgress,
            created_at: default_datetime(),
            updated_at: default_datetime(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArcChapterRelation {
    pub arc_id: String,
    pub chapter_id: String,
    pub sort_order: i32,
    pub phase: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArcEntityRelation {
    pub arc_id: String,
    pub entity_id: String,
}
