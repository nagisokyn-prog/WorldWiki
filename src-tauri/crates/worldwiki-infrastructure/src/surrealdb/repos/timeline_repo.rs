//! SurrealDB implementation of TimelineEventRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::calendar::{EventReveal, TimelineEvent};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::repositories::TimelineEventRepository;

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
        let clean = clean_raw_id!(id, "timeline_events");
        let sql = "SELECT * FROM type::record('timeline_events', $id);";
        surreal_take_one!(self.db, sql, ("id", clean))
    }

    async fn save(&self, event: &TimelineEvent) -> Result<String, DomainError> {
        let clean_id = if event.id.is_empty() {
            None
        } else {
            Some(clean_raw_id!(&event.id, "timeline_events"))
        };
        let proj_clean = clean_raw_id!(&event.project_id, "projects");

        let created: Option<TimelineEvent> = surreal_take_one!(
            self.db,
            "RETURN fn::save_timeline_event($id, $p_id, $cal_id, $title, $description, $m_abs, $duration_minutes, $importance, $color, $location_id);",
            ("id", clean_id),
            ("p_id", proj_clean),
            ("cal_id", event.calendar_id.clone()),
            ("title", event.title.clone()),
            ("description", event.description.clone()),
            ("m_abs", event.m_abs),
            ("duration_minutes", event.duration_minutes),
            ("importance", event.importance as i64),
            ("color", event.color.clone()),
            ("location_id", event.location_id.clone()),
        )?;
        Ok(created.map(|a| a.id).unwrap_or_else(|| event.id.clone()))
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_raw_id!(id, "timeline_events");
        surreal_exec!(self.db, "RETURN fn::delete_timeline_event($id);", ("id", clean))
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<TimelineEvent>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = clean_raw_id!(project_id, "projects");
        let sql = "SELECT id, project_id, title, description, m_abs, calendar_id, block_id, created_at FROM timeline_events WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw OR project_id = $p_clean OR project_id = type::record('projects', $p_raw)) ORDER BY m_abs ASC;";
        surreal_take_list!(self.db, sql, ("p_raw", p_raw), ("p_clean", p_clean))
    }

    async fn add_reveal(&self, reveal: &EventReveal) -> Result<(), DomainError> {
        let ev_clean = clean_raw_id!(&reveal.event_id, "timeline_events");
        let ch_clean = clean_raw_id!(&reveal.chapter_id, "chapters");
        let sql = r#"
            RELATE (type::record('timeline_events', $ev))->revealed_in->(type::record('chapters', $ch)) CONTENT {
                pov_id: $pov_id,
                kind: $kind,
                block_id: $block_id,
                created_at: time::now()
            };
        "#;
        surreal_exec!(
            self.db,
            sql,
            ("ev", ev_clean),
            ("ch", ch_clean),
            ("pov_id", reveal.pov_id.clone()),
            ("kind", reveal.kind.clone()),
            ("block_id", reveal.block_id.clone()),
        )
    }

    async fn remove_reveal(&self, event_id: &str, chapter_id: &str) -> Result<(), DomainError> {
        let ev_clean = clean_raw_id!(event_id, "timeline_events");
        let ch_clean = clean_raw_id!(chapter_id, "chapters");
        let sql = "DELETE revealed_in WHERE in = type::record('timeline_events', $ev) AND out = type::record('chapters', $ch);";
        surreal_exec!(self.db, sql, ("ev", ev_clean), ("ch", ch_clean))
    }
}
