//! SurrealDB implementation of RelationRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::EntityRelation;
use worldwiki_ports::repositories::RelationRepository;
use super::helpers::{clean_id, prepare_data_for_upsert, take_list, take_one};

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
        let sql = "SELECT * FROM type::record('entity_rel', $id);";
        let clean = id.trim_start_matches("entity_rel:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError> {
        let clean = rel.id.trim_start_matches("entity_rel:").to_string();
        let data = prepare_data_for_upsert(
            serde_json::to_value(rel).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('entity_rel', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("entity_rel:").to_string();
        let sql = "DELETE type::record('entity_rel', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn get_entity_relations(
        &self,
        entity_id: &str,
    ) -> Result<Vec<EntityRelation>, DomainError> {
        let clean_target = clean_id("entities", entity_id);
        let sql = "SELECT * FROM entity_rel WHERE in = $target OR out = $target;";
        let mut res = self
            .db
            .query(sql)
            .bind(("target", clean_target))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
