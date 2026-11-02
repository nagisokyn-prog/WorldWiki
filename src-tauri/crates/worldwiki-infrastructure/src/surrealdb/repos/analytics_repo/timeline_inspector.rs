//! Timeline Inspector analytical queries.

use super::matrix::RawChapterHeader;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{TimelineInspectorDto, TimelineInspectorEventNode, TimelineRevealLink};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
struct TimelineRaw {
    events: Vec<RawTimelineEventNode>,
    chapters: Vec<RawChapterHeader>,
}

#[derive(serde::Deserialize)]
struct RawTimelineEventNode {
    id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    m_abs: Option<i64>,
    #[serde(default)]
    calendar_id: Option<String>,
    #[serde(default)]
    reveals: Vec<RawTimelineRevealLink>,
    #[serde(default)]
    participants: Vec<RawParticipant>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    location_id: Option<String>,
}

#[derive(serde::Deserialize)]
struct RawTimelineRevealLink {
    #[serde(default)]
    chapter_id: Option<String>,
    #[serde(default)]
    chapter_title: Option<String>,
    #[serde(default)]
    chapter_sort_order: Option<i32>,
    #[serde(default)]
    chapter_order: Option<i32>,
    #[serde(default)]
    pov_id: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    block_id: Option<String>,
    #[serde(default)]
    is_anachronism: Option<bool>,
}

impl RawTimelineRevealLink {
    fn into_dto(self) -> TimelineRevealLink {
        TimelineRevealLink {
            chapter_id: self.chapter_id.unwrap_or_default(),
            chapter_title: self.chapter_title.unwrap_or_default(),
            chapter_sort_order: self.chapter_sort_order.or(self.chapter_order).unwrap_or(0),
            pov_id: self.pov_id,
            kind: self.kind.unwrap_or_else(|| "direct".to_string()),
            block_id: self.block_id,
            is_anachronism: self.is_anachronism.unwrap_or(false),
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(untagged)]
enum RawParticipant {
    Object {
        #[serde(default)]
        id: Option<String>,
        #[serde(default)]
        name: Option<String>,
    },
    String(String),
}

impl RawParticipant {
    fn into_id(self) -> String {
        match self {
            RawParticipant::Object { id, name } => {
                if let Some(n) = name.filter(|n| !n.trim().is_empty()) {
                    n
                } else {
                    id.unwrap_or_default()
                }
            }
            RawParticipant::String(s) => s,
        }
    }
}

pub(crate) async fn get_timeline_inspector_data_impl(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<TimelineInspectorDto, DomainError> {
    let proj_clean = clean_raw_id!(project_id, "projects");
    let sql = "RETURN fn::get_timeline_inspector_data(type::record('projects', $p));";
    let raw: Option<TimelineRaw> = surreal_take_one!(db, sql, ("p", proj_clean))?;
    let raw = raw.unwrap_or(TimelineRaw {
        events: vec![],
        chapters: vec![],
    });

    let mut event_nodes = Vec::new();
    let mut crossings_count = 0;

    for ev in raw.events {
        let mut reveals_dto = Vec::new();
        for rev in ev.reveals {
            let dto = rev.into_dto();
            if dto.is_anachronism {
                crossings_count += 1;
            }
            reveals_dto.push(dto);
        }

        event_nodes.push(TimelineInspectorEventNode {
            event_id: ev.id,
            title: ev.title,
            description: ev.description,
            m_abs: ev.m_abs.unwrap_or(0),
            calendar_id: ev.calendar_id.unwrap_or_default(),
            participants: ev.participants.into_iter().map(|p| p.into_id()).collect(),
            reveals: reveals_dto,
            kind: ev.kind,
            location_id: ev.location_id,
        });
    }

    Ok(TimelineInspectorDto {
        events: event_nodes,
        chapters: raw.chapters.into_iter().map(|c| c.into_dto()).collect(),
        entity_swimlanes: Vec::new(),
        detected_crossings: crossings_count,
    })
}
