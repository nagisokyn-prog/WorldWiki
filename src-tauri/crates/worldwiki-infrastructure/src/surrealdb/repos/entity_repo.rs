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
        let sql = r#"
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id.type_key AS type_key, 
                name, 
                description, 
                attributes, 
                tags, 
                created_at, 
                updated_at 
            FROM type::record($id);
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        let clean = clean_id("entities", &entity.id);
        let p_clean = clean_id("projects", &entity.project_id);

        let sql = r#"
            LET $p_rec = type::record($p_id);
            LET $schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $entity_type LIMIT 1);
            LET $schema_id = IF array::len($schema_res) > 0 {
                $schema_res[0]
            } ELSE {
                (CREATE entity_schemas SET
                    project_id = $p_rec,
                    type_key = $entity_type,
                    type_name = $entity_type
                )[0].id
            };
            LET $e_rec = type::record($e_id);
            UPSERT $e_rec SET
                schema_id = $schema_id,
                name = $name,
                description = $description,
                tags = $tags,
                attributes = $attributes,
                updated_at = time::now();
        "#;
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
        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(e.to_string()));
        }
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("entities", id);
        let sql = "DELETE type::record($id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn search(
        &self,
        project_id: &str,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = r#"
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id.type_key AS type_key, 
                name, 
                description, 
                attributes, 
                tags, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = type::record($p_clean)
            ORDER BY name ASC;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
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
        let sql = r#"
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id.type_key AS type_key, 
                name, 
                description, 
                attributes, 
                tags, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = type::record($p_clean) 
              AND schema_id.type_key = $type_key 
            ORDER BY name ASC;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .bind(("type_key", type_key.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = r#"
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id.type_key AS type_key, 
                name, 
                description, 
                attributes, 
                tags, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = type::record($p_clean) 
            ORDER BY name ASC;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
