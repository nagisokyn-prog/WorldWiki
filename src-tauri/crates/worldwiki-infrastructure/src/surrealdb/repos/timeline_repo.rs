//! SurrealDB implementation of TimelineEventRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
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
        surreal_take_one!(
            self.db,
            "RETURN fn::get_timeline_event($id);",
            ("id", clean)
        )
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
            "RETURN fn::save_timeline_event($id, $p_id, $cal_id, $title, $description, $m_abs);",
            ("id", clean_id),
            ("p_id", proj_clean),
            ("cal_id", event.calendar_id.clone()),
            ("title", event.title.clone()),
            ("description", event.description.clone()),
            ("m_abs", event.m_abs),
        )?;
        Ok(created.map(|a| a.id).unwrap_or_else(|| event.id.clone()))
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_raw_id!(id, "timeline_events");
        surreal_exec!(
            self.db,
            "RETURN fn::delete_timeline_event($id);",
            ("id", clean)
        )
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<TimelineEvent>, DomainError> {
        let p_clean = clean_raw_id!(project_id, "projects");
        surreal_take_list!(
            self.db,
            "RETURN fn::list_timeline_events_by_project($p_clean);",
            ("p_clean", p_clean)
        )
    }

    async fn add_reveal(&self, reveal: &EventReveal) -> Result<(), DomainError> {
        let clean_ev = clean_raw_id!(&reveal.event_id, "timeline_events");
        let clean_ch = clean_raw_id!(&reveal.chapter_id, "chapters");
        let pov = reveal.pov_id.as_deref().map(|p| clean_raw_id!(p, "entities"));
        surreal_exec!(
            self.db,
            "RETURN fn::add_event_reveal($ev, $ch, $pov, $kind, $block);",
            ("ev", clean_ev),
            ("ch", clean_ch),
            ("pov", pov),
            ("kind", reveal.kind.clone()),
            ("block", reveal.block_id.clone()),
        )
    }

    async fn remove_reveal(&self, event_id: &str, chapter_id: &str) -> Result<(), DomainError> {
        let clean_ev = clean_raw_id!(event_id, "timeline_events");
        let clean_ch = clean_raw_id!(chapter_id, "chapters");
        surreal_exec!(
            self.db,
            "RETURN fn::remove_event_reveal($ev, $ch);",
            ("ev", clean_ev),
            ("ch", clean_ch),
        )
    }
}
