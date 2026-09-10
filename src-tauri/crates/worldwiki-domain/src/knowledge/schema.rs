use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntityFieldSchema {
    pub key: String,
    pub label: String,
    pub field_type: String, // "text", "textarea", "number", "boolean", "select", "multi_select", "date", "entity_ref", "range", "tags"
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub default_value: Option<Value>,
    #[serde(default)]
    pub placeholder: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntitySchema {
    pub id: String,
    pub project_id: String,
    pub type_key: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub fields: Vec<EntityFieldSchema>,
    #[serde(default)]
    pub full_schema: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NormalizedFieldDef {
    pub key: String,
    pub label: String,
    pub field_type: String, // "text", "textarea", "number", "boolean", "select", "range", "entity_ref", "chapter_ref", "calendar_date", "tags"
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub entity_type_ref: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_value: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NormalizedDynamicListDef {
    pub data_path: String,
    pub label: String,
    pub item_fields: HashMap<String, NormalizedFieldDef>,
    #[serde(default)]
    pub is_timeline: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NormalizedEntitySchema {
    pub entity_type: String,
    pub title: String,
    pub flat_fields: HashMap<String, NormalizedFieldDef>,
    pub dynamic_lists: HashMap<String, NormalizedDynamicListDef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SchemaValidationError {
    pub field: String,
    pub message: String,
    #[serde(default)]
    pub expected_type: Option<String>,
}
