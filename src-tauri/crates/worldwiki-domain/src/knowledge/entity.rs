use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub project_id: String,
    pub type_key: String, // "character", "location", "faction", "item", etc.
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub attributes: Value,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Entity {
    pub fn new(project_id: impl Into<String>, type_key: impl Into<String>, name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            type_key: type_key.into(),
            name: name.into(),
            description: None,
            attributes: Value::Object(serde_json::Map::new()),
            tags: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }
}
