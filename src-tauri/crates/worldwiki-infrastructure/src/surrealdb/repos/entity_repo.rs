//! SurrealDB implementation of EntityRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::Entity;
use worldwiki_ports::repositories::EntityRepository;
use super::helpers::{fuzzy_match_name, project_where_clause, take_list, take_one};

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
        let sql = "SELECT * FROM type::record('entities', $id);";
        let clean = id.trim_start_matches("entities:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        let clean = entity.id.trim_start_matches("entities:").to_string();
        let proj_clean = entity
            .project_id
            .trim_start_matches("projects:")
            .to_string();

        let sql = r#"
            UPSERT type::record('entities', $e_id) MERGE {
                project_id: type::record('projects', $p_id),
                entity_type: $entity_type,
                name: $name,
                description: $description,
                attributes: $attributes,
                tags: $tags,
                updated_at: time::now()
            };
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("e_id", clean))
            .bind(("p_id", proj_clean))
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
        let clean = id.trim_start_matches("entities:").to_string();
        let sql = "DELETE type::record('entities', $id);";
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM entities WHERE {where_clause};");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM entities WHERE {where_clause} AND (entity_type = $type_key OR type_key = $type_key) ORDER BY name ASC;");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .bind(("type_key", type_key.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
