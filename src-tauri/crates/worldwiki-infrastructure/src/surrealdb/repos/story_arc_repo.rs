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

    async fn assign_chapter(&self, relation: &ArcChapterRelation) -> Result<(), DomainError> {
        let arc_clean = relation.arc_id.trim_start_matches("story_arcs:");
        let ch_clean = relation.chapter_id.trim_start_matches("chapters:");
        let sql = r#"
            RELATE (type::record('story_arcs', $arc))->arc_chapters->(type::record('chapters', $ch)) CONTENT {
                project_id: (SELECT VALUE project_id FROM ONLY type::record('story_arcs', $arc)),
                sort_order: $sort_order,
                phase: $phase
            };
        "#;
        self.db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("ch", ch_clean.to_string()))
            .bind(("sort_order", relation.sort_order as i64))
            .bind(("phase", relation.phase.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn remove_chapter(&self, arc_id: &str, chapter_id: &str) -> Result<(), DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let ch_clean = chapter_id.trim_start_matches("chapters:");
        let sql = "DELETE arc_chapters WHERE (in = type::record('story_arcs', $arc) OR in = $arc_full) AND (out = type::record('chapters', $ch) OR out = $ch_full);";
        let arc_full = format!("story_arcs:{arc_clean}");
        let ch_full = format!("chapters:{ch_clean}");
        self.db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .bind(("ch", ch_clean.to_string()))
            .bind(("ch_full", ch_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn assign_entity(&self, relation: &ArcEntityRelation) -> Result<(), DomainError> {
        let arc_clean = relation.arc_id.trim_start_matches("story_arcs:");
        let ent_clean = relation.entity_id.trim_start_matches("entities:");
        let sql = r#"
            RELATE (type::record('story_arcs', $arc))->arc_entities->(type::record('entities', $ent)) CONTENT {
                project_id: (SELECT VALUE project_id FROM ONLY type::record('story_arcs', $arc))
            };
        "#;
        self.db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("ent", ent_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn remove_entity(&self, arc_id: &str, entity_id: &str) -> Result<(), DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let ent_clean = entity_id.trim_start_matches("entities:");
        let sql = "DELETE arc_entities WHERE (in = type::record('story_arcs', $arc) OR in = $arc_full) AND (out = type::record('entities', $ent) OR out = $ent_full);";
        let arc_full = format!("story_arcs:{arc_clean}");
        let ent_full = format!("entities:{ent_clean}");
        self.db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .bind(("ent", ent_clean.to_string()))
            .bind(("ent_full", ent_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_chapters_for_arc(&self, arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let arc_full = format!("story_arcs:{arc_clean}");
        let sql = "SELECT in AS arc_id, out AS chapter_id, sort_order, phase FROM arc_chapters WHERE in = type::record('story_arcs', $arc) OR in = $arc_full ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
        let arc_clean = arc_id.trim_start_matches("story_arcs:");
        let arc_full = format!("story_arcs:{arc_clean}");
        let sql = "SELECT in AS arc_id, out AS entity_id FROM arc_entities WHERE in = type::record('story_arcs', $arc) OR in = $arc_full;";
        let mut res = self
            .db
            .query(sql)
            .bind(("arc", arc_clean.to_string()))
            .bind(("arc_full", arc_full))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
