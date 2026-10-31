//! SurrealDB implementation of EntityRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::Entity;
use worldwiki_ports::repositories::EntityRepository;
use super::helpers::{clean_id, fuzzy_match_name};

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
        surreal_take_one!(self.db, "RETURN fn::get_entity_full($id);", ("id", clean))
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        let clean = clean_id("entities", &entity.id);
        let p_clean = clean_id("projects", &entity.project_id);
        surreal_exec!(
            self.db,
            "RETURN fn::save_entity_full($e_id, $p_id, $entity_type, $name, $description, $attributes, $tags);",
            ("e_id", clean),
            ("p_id", p_clean),
            ("entity_type", entity.type_key.clone()),
            ("name", entity.name.clone()),
            ("description", entity.description.clone()),
            ("attributes", entity.attributes.clone()),
            ("tags", entity.tags.clone()),
        )
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("entities", id);
        surreal_exec!(self.db, "RETURN fn::delete_entity_full($id);", ("id", clean))
    }

    async fn search(
        &self,
        project_id: &str,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let all_entities: Vec<Entity> = surreal_take_list!(
            self.db,
            "RETURN fn::list_entities_by_project_full($p_clean);",
            ("p_clean", p_clean),
        )?;

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
        surreal_take_list!(
            self.db,
            "RETURN fn::list_entities_by_type_full($p_clean, $type_key);",
            ("p_clean", p_clean),
            ("type_key", type_key.to_string()),
        )
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_entities_by_project_full($p_clean);",
            ("p_clean", p_clean),
        )
    }
}
