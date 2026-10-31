//! SurrealDB implementation of StoryArcRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, StoryArc};
use worldwiki_ports::repositories::StoryArcRepository;
use super::helpers::{clean_id, take_list, take_one};

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
        let sql = "SELECT * FROM type::record('story_arcs', $id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
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

        let sql = if let Some(id) = clean_id_opt {
            let s = r#"
                UPSERT type::record('story_arcs', $id) MERGE {
                    title: $title,
                    status: $status,
                    project_id: type::record('projects', $p_id),
                    updated_at: time::now()
                };
            "#;
            let mut res = self
                .db
                .query(s)
                .bind(("id", id.clone()))
                .bind(("p_id", proj_clean))
                .bind(("title", arc.title.clone()))
                .bind(("status", serde_json::to_string(&arc.status).unwrap_or_default().trim_matches('"').to_string()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let errors = res.take_errors();
            if let Some((_, e)) = errors.into_iter().next() {
                return Err(DomainError::ConstraintViolation(e.to_string()));
            }
            format!("story_arcs:{}", id)
        } else {
            let s = r#"
                CREATE story_arcs CONTENT {
                    title: $title,
                    status: $status,
                    project_id: type::record('projects', $p_id),
                    created_at: time::now(),
                    updated_at: time::now()
                };
            "#;
            let mut res = self
                .db
                .query(s)
                .bind(("p_id", proj_clean))
                .bind(("title", arc.title.clone()))
                .bind(("status", serde_json::to_string(&arc.status).unwrap_or_default().trim_matches('"').to_string()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let created: Option<StoryArc> = take_one(&mut res, 0)?;
            created.map(|a| a.id).unwrap_or_default()
        };

        Ok(sql)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("story_arcs", id);
        let sql = "DELETE type::record('story_arcs', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<StoryArc>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "SELECT id, project_id, title, status, created_at, updated_at FROM story_arcs WHERE project_id = type::record('projects', $p_clean) ORDER BY created_at ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
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
        let sql = r#"
            LET $arc_rec = type::record('story_arcs', $arc_id);
            SELECT 
                $arc_id AS arc_id,
                type::string(in.chapter_id) AS chapter_id,
                in.chapter_id.sort_order AS sort_order,
                phase
            FROM advances_arc 
            WHERE out = $arc_rec
            ORDER BY in.chapter_id.sort_order ASC;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("arc_id", clean_arc))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 1)
    }

    async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
        let clean_arc = clean_id("story_arcs", arc_id);
        let sql = r#"
            LET $arc_rec = type::record('story_arcs', $arc_id);
            SELECT DISTINCT
                $arc_id AS arc_id,
                type::string(<-participant_of.in.id) AS entity_id
            FROM (SELECT VALUE in FROM advances_arc WHERE out = $arc_rec);
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("arc_id", clean_arc))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 1)
    }
}
