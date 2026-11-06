//! SurrealDB implementation of RelationRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::EntityRelation;
use worldwiki_ports::repositories::RelationRepository;

pub struct SurrealRelationRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealRelationRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl RelationRepository for SurrealRelationRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError> {
        let clean = clean_raw_id!(id, "entity_rel");
        surreal_take_one!(self.db, "RETURN fn::get_entity_relation($id);", ("id", clean))
    }

    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError> {
        let clean = if rel.id.trim().is_empty() {
            None
        } else {
            Some(clean_raw_id!(&rel.id, "entity_rel"))
        };
        let from_clean = clean_raw_id!(&rel.from_entity_id, "entities");
        let to_clean = clean_raw_id!(&rel.to_entity_id, "entities");
        let start_at = rel.start_at.as_deref().map(|s| {
            if s.contains(':') { s.to_string() } else { format!("chapters:{s}") }
        });
        let end_at = rel.end_at.as_deref().map(|s| {
            if s.contains(':') { s.to_string() } else { format!("chapters:{s}") }
        });
        let attrs = if rel.attributes.is_object() {
            rel.attributes.clone()
        } else {
            serde_json::json!({})
        };

        surreal_exec!(
            self.db,
            "RETURN fn::save_entity_relation($id, $from, $to, $rel_type, $desc, $strength, $attrs, $start, $end);",
            ("id", clean),
            ("from", from_clean),
            ("to", to_clean),
            ("rel_type", rel.rel_type.clone()),
            ("desc", rel.description.clone()),
            ("strength", rel.strength),
            ("attrs", attrs),
            ("start", start_at),
            ("end", end_at),
        )
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_raw_id!(id, "entity_rel");
        surreal_exec!(self.db, "RETURN fn::delete_entity_relation($id);", ("id", clean))
    }

    async fn get_entity_relations(
        &self,
        entity_id: &str,
    ) -> Result<Vec<EntityRelation>, DomainError> {
        let clean_target = clean_raw_id!(entity_id, "entities");
        surreal_take_list!(
            self.db,
            "RETURN fn::get_entity_relations(type::record('entities', $target));",
            ("target", clean_target),
        )
    }
}
