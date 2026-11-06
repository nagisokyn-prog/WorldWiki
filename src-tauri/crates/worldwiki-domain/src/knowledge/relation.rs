use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntityRelation {
    #[serde(default)]
    pub id: String,
    #[serde(alias = "from", alias = "from_entity", alias = "source_id", alias = "from_id", alias = "in")]
    pub from_entity_id: String,
    #[serde(alias = "to", alias = "to_entity", alias = "target_id", alias = "to_id", alias = "out")]
    pub to_entity_id: String,
    #[serde(alias = "relation_type", alias = "type", alias = "rel")]
    pub rel_type: String, // "ally", "enemy", "parent_of", "located_in", "member_of", etc.
    #[serde(default)]
    pub description: Option<String>,
    pub strength: Option<i32>, // -100..100
    #[serde(default, alias = "start_chapter_id", alias = "start_chapter")]
    pub start_at: Option<String>,
    #[serde(default, alias = "end_chapter_id", alias = "end_chapter")]
    pub end_at: Option<String>,
    #[serde(default)]
    pub is_auto_extend: bool,
    #[serde(default)]
    pub attributes: Value,
}

impl EntityRelation {
    pub fn new(
        from: impl Into<String>,
        to: impl Into<String>,
        rel_type: impl Into<String>,
    ) -> Self {
        Self {
            id: String::new(),
            from_entity_id: from.into(),
            to_entity_id: to.into(),
            rel_type: rel_type.into(),
            description: None,
            strength: None,
            start_at: None,
            end_at: None,
            is_auto_extend: false,
            attributes: Value::Object(serde_json::Map::new()),
        }
    }
}
