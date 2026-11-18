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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entity_relation_new_and_serde_aliases() {
        let rel = EntityRelation::new("entities:a", "entities:b", "ally");
        assert_eq!(rel.from_entity_id, "entities:a");
        assert_eq!(rel.to_entity_id, "entities:b");
        assert_eq!(rel.rel_type, "ally");
        assert!(!rel.is_auto_extend);

        let raw = r#"{"in":"entities:x","out":"entities:y","rel":"enemy","strength":-50}"#;
        let parsed: EntityRelation = serde_json::from_str(raw).unwrap();
        assert_eq!(parsed.from_entity_id, "entities:x");
        assert_eq!(parsed.to_entity_id, "entities:y");
        assert_eq!(parsed.rel_type, "enemy");
        assert_eq!(parsed.strength, Some(-50));
    }
}
