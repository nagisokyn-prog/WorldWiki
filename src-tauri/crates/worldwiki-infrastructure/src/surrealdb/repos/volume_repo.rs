//! SurrealDB implementation of VolumeRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::Volume;
use worldwiki_ports::repositories::VolumeRepository;
use super::helpers::clean_id;

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
        surreal_take_one!(self.db, "RETURN fn::get_volume($id);", ("id", clean))
    }

    async fn save(&self, volume: &Volume) -> Result<(), DomainError> {
        let clean = clean_id("volumes", &volume.id);
        let proj_clean = clean_id("projects", &volume.project_id);
        surreal_exec!(
            self.db,
            "RETURN fn::save_volume($id, $p_id, $title);",
            ("id", clean),
            ("p_id", proj_clean),
            ("title", volume.title.clone()),
        )
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("volumes", id);
        surreal_exec!(self.db, "RETURN fn::delete_volume($id);", ("id", clean))
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_volumes_by_project($p_clean);",
            ("p_clean", p_clean),
        )
    }
}
