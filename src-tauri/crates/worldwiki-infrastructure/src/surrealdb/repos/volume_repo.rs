//! SurrealDB implementation of VolumeRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::Volume;
use worldwiki_ports::repositories::VolumeRepository;
use super::helpers::{prepare_data_for_upsert, take_list, take_one};

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
        let sql = "SELECT * FROM type::record('volumes', $id);";
        let clean = id.trim_start_matches("volumes:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, volume: &Volume) -> Result<(), DomainError> {
        let clean = volume.id.trim_start_matches("volumes:").to_string();
        let data = prepare_data_for_upsert(
            serde_json::to_value(volume).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('volumes', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("volumes:").to_string();
        let sql = "DELETE type::record('volumes', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let sql = "SELECT id, project_id, title, sort_order FROM volumes WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw OR project_id = $p_clean OR project_id = type::record('projects', $p_raw)) ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
