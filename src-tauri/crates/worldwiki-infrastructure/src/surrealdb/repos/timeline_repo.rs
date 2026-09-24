//! SurrealDB implementation of TimelineEventRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::calendar::{EventReveal, TimelineEvent};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::repositories::TimelineEventRepository;
use super::helpers::{project_where_clause, take_list, take_one};

pub struct SurrealTimelineRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealTimelineRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl TimelineEventRepository for SurrealTimelineRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<TimelineEvent>, DomainError> {
        let clean = id.trim_start_matches("timeline_events:");
        let sql = "SELECT * FROM type::record('timeline_events', $id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, event: &TimelineEvent) -> Result<String, DomainError> {
        let clean_id = if event.id.is_empty() {
            None
        } else {
            Some(event.id.trim_start_matches("timeline_events:").to_string())
        };
        let proj_clean = event.project_id.trim_start_matches("projects:").to_string();

        let sql = if let Some(id) = clean_id {
            let s = r#"
                UPSERT type::record('timeline_events', $id) MERGE {
                    title: $title,
                    description: $description,
                    m_abs: $m_abs,
                    duration_minutes: $duration_minutes,
                    importance: $importance,
                    color: $color,
                    location_id: $location_id,
                    chapter_id: $chapter_id,
                    project_id: type::record('projects', $p_id),
                    updated_at: time::now()
                };
            "#;
            let mut res = self
                .db
                .query(s)
                .bind(("id", id.clone()))
                .bind(("p_id", proj_clean))
                .bind(("title", event.title.clone()))
                .bind(("description", event.description.clone()))
                .bind(("m_abs", event.m_abs))
                .bind(("duration_minutes", event.duration_minutes))
                .bind(("importance", event.importance as i64))
                .bind(("color", event.color.clone()))
                .bind(("location_id", event.location_id.clone()))
                .bind(("chapter_id", event.chapter_id.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let errors = res.take_errors();
            if let Some((_, e)) = errors.into_iter().next() {
                return Err(DomainError::ConstraintViolation(e.to_string()));
            }
            format!("timeline_events:{}", id)
        } else {
            let s = r#"
                CREATE timeline_events CONTENT {
                    title: $title,
                    description: $description,
                    m_abs: $m_abs,
                    duration_minutes: $duration_minutes,
                    importance: $importance,
                    color: $color,
                    location_id: $location_id,
                    chapter_id: $chapter_id,
                    project_id: type::record('projects', $p_id),
                    calendar_id: $cal_id,
                    created_at: time::now(),
                    updated_at: time::now()
                };
            "#;
            let mut res = self
                .db
                .query(s)
                .bind(("p_id", proj_clean))
                .bind(("cal_id", event.calendar_id.clone()))
                .bind(("title", event.title.clone()))
                .bind(("description", event.description.clone()))
                .bind(("m_abs", event.m_abs))
                .bind(("duration_minutes", event.duration_minutes))
                .bind(("importance", event.importance as i64))
                .bind(("color", event.color.clone()))
                .bind(("location_id", event.location_id.clone()))
                .bind(("chapter_id", event.chapter_id.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let created: Option<TimelineEvent> = take_one(&mut res, 0)?;
            created.map(|a| a.id).unwrap_or_default()
        };

        Ok(sql)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("timeline_events:").to_string();
        let sql = "DELETE type::record('timeline_events', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<TimelineEvent>, DomainError> {
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
        let sql = format!("SELECT * FROM timeline_events WHERE {where_clause} ORDER BY m_abs ASC;");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn add_reveal(&self, reveal: &EventReveal) -> Result<(), DomainError> {
        let ev_clean = reveal.event_id.trim_start_matches("timeline_events:");
        let ch_clean = reveal.chapter_id.trim_start_matches("chapters:");
        let sql = r#"
            RELATE (type::record('timeline_events', $ev))->revealed_in->(type::record('chapters', $ch)) CONTENT {
                pov_id: $pov_id,
                kind: $kind,
                block_id: $block_id,
                created_at: time::now()
            };
        "#;
        self.db
            .query(sql)
            .bind(("ev", ev_clean.to_string()))
            .bind(("ch", ch_clean.to_string()))
            .bind(("pov_id", reveal.pov_id.clone()))
            .bind(("kind", reveal.kind.clone()))
            .bind(("block_id", reveal.block_id.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn remove_reveal(&self, event_id: &str, chapter_id: &str) -> Result<(), DomainError> {
        let ev_clean = event_id.trim_start_matches("timeline_events:");
        let ch_clean = chapter_id.trim_start_matches("chapters:");
        let sql = "DELETE revealed_in WHERE in = type::record('timeline_events', $ev) AND out = type::record('chapters', $ch);";
        self.db
            .query(sql)
            .bind(("ev", ev_clean.to_string()))
            .bind(("ch", ch_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }
}
