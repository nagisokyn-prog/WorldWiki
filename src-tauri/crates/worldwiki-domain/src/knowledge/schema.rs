use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntityFieldSchema {
    pub key: String,
    pub label: String,
    pub field_type: String, // "text", "number", "boolean", "select", "multi_select", "date", "entity_ref"
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    pub default_value: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntitySchema {
    pub id: String,
    pub project_id: String,
    pub type_key: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<EntityFieldSchema>,
}
