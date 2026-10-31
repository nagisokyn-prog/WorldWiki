//! SurrealDB implementation of StoryArcRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, StoryArc};
use worldwiki_ports::repositories::StoryArcRepository;
use super::helpers::clean_id;

pub struct SurrealStoryArcRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealStoryArcRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl StoryArcRepository for SurrealStoryArcRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<StoryArc>, DomainError> {
        let clean = clean_id("story_arcs", id);
        surreal_take_one!(self.db, "RETURN fn::get_story_arc($id);", ("id", clean))
    }

    async fn save(&self, arc: &StoryArc) -> Result<String, DomainError> {
        if arc.title.trim().is_empty() {
            return Err(DomainError::Validation("Arc title cannot be empty".to_string()));
        }
        let clean_id_opt = if arc.id.is_empty() {
            None
        } else {
            Some(clean_id("story_arcs", &arc.id))
        };
        let proj_clean = clean_id("projects", &arc.project_id);
        let status_str = serde_json::to_string(&arc.status).unwrap_or_default().trim_matches('"').to_string();

        let created: Option<StoryArc> = surreal_take_one!(
            self.db,
            "RETURN fn::save_story_arc($id, $p_id, $title, $status);",
            ("id", clean_id_opt),
            ("p_id", proj_clean),
            ("title", arc.title.clone()),
            ("status", status_str),
        )?;
        Ok(created.map(|a| a.id).unwrap_or_else(|| arc.id.clone()))
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("story_arcs", id);
        surreal_exec!(self.db, "RETURN fn::delete_story_arc($id);", ("id", clean))
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<StoryArc>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_story_arcs_by_project($p_clean);",
            ("p_clean", p_clean),
        )
    }

    async fn assign_chapter(&self, _relation: &ArcChapterRelation) -> Result<(), DomainError> {
        Ok(())
    }

    async fn remove_chapter(&self, _arc_id: &str, _chapter_id: &str) -> Result<(), DomainError> {
        Ok(())
    }

    async fn assign_entity(&self, _relation: &ArcEntityRelation) -> Result<(), DomainError> {
        Ok(())
    }

    async fn remove_entity(&self, _arc_id: &str, _entity_id: &str) -> Result<(), DomainError> {
        Ok(())
    }

    async fn list_chapters_for_arc(&self, arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError> {
        let clean_arc = clean_id("story_arcs", arc_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_chapters_for_arc($arc_id);",
            ("arc_id", clean_arc),
        )
    }

    async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
        let clean_arc = clean_id("story_arcs", arc_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_entities_for_arc($arc_id);",
            ("arc_id", clean_arc),
        )
    }
}
