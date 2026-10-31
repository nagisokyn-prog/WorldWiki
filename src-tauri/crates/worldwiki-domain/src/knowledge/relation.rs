use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EntityRelation {
    #[serde(default)]
    pub id: String,
    pub project_id: String,
    #[serde(alias = "from", alias = "from_entity", alias = "source_id", alias = "from_id", alias = "in")]
    pub from_entity_id: String,
    #[serde(alias = "to", alias = "to_entity", alias = "target_id", alias = "to_id", alias = "out")]
    pub to_entity_id: String,
    #[serde(alias = "relation_type", alias = "type", alias = "rel")]
    pub rel_type: String, // "ally", "enemy", "parent_of", "located_in", "member_of", etc.
    pub strength: Option<i32>, // -100..100
    pub start_chapter_id: Option<String>,
    pub end_chapter_id: Option<String>,
    #[serde(default)]
    pub attributes: Value,
}

impl EntityRelation {
    pub fn new(
        project_id: impl Into<String>,
        from: impl Into<String>,
        to: impl Into<String>,
        rel_type: impl Into<String>,
    ) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            from_entity_id: from.into(),
            to_entity_id: to.into(),
            rel_type: rel_type.into(),
            strength: None,
            start_chapter_id: None,
            end_chapter_id: None,
            attributes: Value::Object(serde_json::Map::new()),
        }
    }
}
