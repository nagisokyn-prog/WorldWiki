//! SurrealDB implementation of VolumeRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::Volume;
use worldwiki_ports::repositories::VolumeRepository;
use super::helpers::{clean_id, take_list, take_one};

pub struct SurrealVolumeRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealVolumeRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl VolumeRepository for SurrealVolumeRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Volume>, DomainError> {
        let clean = clean_id("volumes", id);
        let sql = "SELECT * FROM type::record($id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, volume: &Volume) -> Result<(), DomainError> {
        let clean = clean_id("volumes", &volume.id);
        let proj_clean = clean_id("projects", &volume.project_id);
        let sql = r#"
            UPSERT type::record($id) SET
                title = $title,
                project_id = type::record($p_id);
        "#;
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("p_id", proj_clean))
            .bind(("title", volume.title.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("volumes", id);
        let sql = "DELETE type::record($id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "SELECT id, project_id, title FROM volumes WHERE project_id = type::record($p_clean);";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
