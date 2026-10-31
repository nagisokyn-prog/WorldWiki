//! SurrealDB implementation of EntityRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::Entity;
use worldwiki_ports::repositories::EntityRepository;
use super::helpers::{clean_id, fuzzy_match_name, take_list, take_one};

pub struct SurrealEntityRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealEntityRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl EntityRepository for SurrealEntityRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError> {
        let clean = clean_id("entities", id);
        let sql = "RETURN fn::get_entity_full($id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        let clean = clean_id("entities", &entity.id);
        let p_clean = clean_id("projects", &entity.project_id);

        let sql = "RETURN fn::save_entity_full($e_id, $p_id, $entity_type, $name, $description, $attributes, $tags);";
        let mut res = self
            .db
            .query(sql)
            .bind(("e_id", clean))
            .bind(("p_id", p_clean))
            .bind(("entity_type", entity.type_key.clone()))
            .bind(("name", entity.name.clone()))
            .bind(("description", entity.description.clone()))
            .bind(("attributes", entity.attributes.clone()))
            .bind(("tags", entity.tags.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("entities", id);
        let sql = "RETURN fn::delete_entity_full($id);";
        let mut res = self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn search(
        &self,
        project_id: &str,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "RETURN fn::list_entities_by_project_full($p_clean);";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let all_entities: Vec<Entity> = take_list(&mut res, 0)?;

        let q_trimmed = query.trim();
        if q_trimmed.is_empty() {
            let mut list = all_entities;
            list.truncate(top_k);
            return Ok(list);
        }

        let mut matched = Vec::new();
        for entity in all_entities {
            if fuzzy_match_name(q_trimmed, &entity.name, &entity.tags)
                || entity.name.to_lowercase().contains(&q_trimmed.to_lowercase())
                || entity
                    .description
                    .as_ref()
                    .map(|d| d.to_lowercase().contains(&q_trimmed.to_lowercase()))
                    .unwrap_or(false)
            {
                matched.push(entity);
            }
            if matched.len() >= top_k {
                break;
            }
        }
        Ok(matched)
    }

    async fn list_by_type(
        &self,
        project_id: &str,
        type_key: &str,
    ) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "RETURN fn::list_entities_by_type_full($p_clean, $type_key);";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .bind(("type_key", type_key.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "RETURN fn::list_entities_by_project_full($p_clean);";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
