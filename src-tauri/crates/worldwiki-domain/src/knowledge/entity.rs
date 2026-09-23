use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub project_id: String,
    /// Тип сущности: "character", "location", "faction", "item".
    /// В схеме БД поле называется `entity_type`, но в Rust используем `type_key`.
    /// При сериализации в JSON имя будет `type_key` — в запросах к БД используем
    /// `$type_key` параметр и маппим в `entity_type` явно.
    #[serde(alias = "entity_type")]
    pub type_key: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub attributes: Value,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Entity {
    pub fn new(project_id: impl Into<String>, type_key: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            type_key: type_key.into(),
            name: name.into(),
            description: None,
            attributes: Value::Object(serde_json::Map::new()),
            tags: Vec::new(),
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }
}
