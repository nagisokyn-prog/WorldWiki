//! SurrealDB implementation of StoryArcRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, StoryArc};
use worldwiki_ports::repositories::StoryArcRepository;
use super::helpers::{take_list, take_one};

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
        let clean = id.trim_start_matches("story_arcs:");
        let sql = "SELECT * FROM type::record('story_arcs', $id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, arc: &StoryArc) -> Result<String, DomainError> {
        if arc.title.trim().is_empty() {
            return Err(DomainError::Validation("Arc title cannot be empty".to_string()));
        }
        let clean_id = if arc.id.is_empty() {
            None
        } else {
            Some(arc.id.trim_start_matches("story_arcs:").to_string())
        };
        let proj_clean = arc.project_id.trim_start_matches("projects:").to_string();

        let sql = if let Some(id) = clean_id {
            let s = r#"
                UPSERT type::record('story_arcs', $id) MERGE {
                    title: $title,
                    description: $description,
                    arc_type: $arc_type,
                    status: $status,
                    color: $color,
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
                .bind(("description", arc.description.clone()))
                .bind(("arc_type", serde_json::to_string(&arc.arc_type).unwrap_or_default().trim_matches('"').to_string()))
                .bind(("status", serde_json::to_string(&arc.status).unwrap_or_default().trim_matches('"').to_string()))
                .bind(("color", arc.color.clone()))
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
                    description: $description,
                    arc_type: $arc_type,
                    status: $status,
                    color: $color,
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
                .bind(("description", arc.description.clone()))
                .bind(("arc_type", serde_json::to_string(&arc.arc_type).unwrap_or_default().trim_matches('"').to_string()))
                .bind(("status", serde_json::to_string(&arc.status).unwrap_or_default().trim_matches('"').to_string()))
                .bind(("color", arc.color.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let created: Option<StoryArc> = take_one(&mut res, 0)?;
            created.map(|a| a.id).unwrap_or_default()
        };

        Ok(sql)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("story_arcs:").to_string();
        let sql = "DELETE type::record('story_arcs', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<StoryArc>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let sql = "SELECT id, project_id, title, description, arc_type, status, color, created_at, updated_at FROM story_arcs WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw OR project_id = $p_clean OR project_id = type::record('projects', $p_raw)) ORDER BY created_at ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn assign_chapter(&self, _relation: &ArcChapterRelation) -> Result<(), DomainError> {
        // Связь арки с главами определяется нарративными узлами (plot_promises) через advances_arc
        Ok(())
    }

    async fn remove_chapter(&self, _arc_id: &str, _chapter_id: &str) -> Result<(), DomainError> {
        Ok(())
    }

    async fn assign_entity(&self, _relation: &ArcEntityRelation) -> Result<(), DomainError> {
        // Связь арки с сущностями определяется участниками сцен (participant_of) через advances_arc
        Ok(())
    }

    async fn remove_entity(&self, _arc_id: &str, _entity_id: &str) -> Result<(), DomainError> {
        Ok(())
    }

    async fn list_chapters_for_arc(&self, arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let arc_full = format!("story_arcs:{arc_clean}");
        let sql = r#"
            SELECT 
                type::string(out) AS arc_id,
                type::string(array::first(in->promise_milestones.out.chapter_id)) AS chapter_id,
                0 AS sort_order,
                phase
            FROM advances_arc 
            WHERE (out = type::record('story_arcs', $arc) OR out = $arc_full)
              AND array::len(in->promise_milestones) > 0;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let list: Vec<ArcChapterRelation> = take_list(&mut res, 0)?;
        let mut deduped = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for item in list {
            if !item.chapter_id.is_empty() && seen.insert(item.chapter_id.clone()) {
                deduped.push(item);
            }
        }
        Ok(deduped)
    }

    async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let arc_full = format!("story_arcs:{arc_clean}");
        let sql = r#"
            SELECT 
                type::string(out) AS arc_id,
                type::string(array::first(in<-participant_of.in.id)) AS entity_id
            FROM advances_arc 
            WHERE (out = type::record('story_arcs', $arc) OR out = $arc_full)
              AND array::len(in<-participant_of) > 0;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let list: Vec<ArcEntityRelation> = take_list(&mut res, 0)?;
        let mut deduped = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for item in list {
            if !item.entity_id.is_empty() && seen.insert(item.entity_id.clone()) {
                deduped.push(item);
            }
        }
        Ok(deduped)
    }
}
