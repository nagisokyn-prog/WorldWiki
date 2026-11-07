//! Single Character Journey query and assembly.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, JourneyAppearanceDto, JourneyEventDto, JourneyPromiseDto,
    JourneyRelationDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(serde::Deserialize)]
struct JourneyRaw {
    #[serde(default)]
    entity: Option<RawJourneyEntityInfo>,
    #[serde(default)]
    appearances: Vec<RawJourneyAppearance>,
    #[serde(default)]
    events: Vec<RawJourneyEvent>,
    #[serde(default)]
    relations: Vec<RawJourneyRelation>,
    #[serde(default)]
    promises: Vec<RawJourneyPromise>,
}

#[derive(serde::Deserialize)]
struct RawJourneyEntityInfo {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    entity_type: Option<String>,
    #[serde(default)]
    attributes: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct RawJourneyAppearance {
    #[serde(default)]
    chapter_id: Option<String>,
    #[serde(default)]
    chapter_title: Option<String>,
    #[serde(default)]
    chapter_order: Option<i32>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    quote: Option<String>,
    #[serde(default)]
    block_id: Option<String>,
    #[serde(default)]
    paragraph_index: Option<i64>,
}

impl RawJourneyAppearance {
    fn into_dto(self) -> JourneyAppearanceDto {
        JourneyAppearanceDto {
            chapter_id: self.chapter_id.unwrap_or_default(),
            chapter_title: self.chapter_title.unwrap_or_else(|| "Без названия".to_string()),
            chapter_order: self.chapter_order.unwrap_or(0),
            source: self.source.unwrap_or_else(|| "mention".to_string()),
            role: self.role,
            created_at: self.created_at.unwrap_or_default(),
            quote: self.quote,
            block_id: self.block_id,
            paragraph_index: self.paragraph_index,
        }
    }
}

#[derive(serde::Deserialize)]
struct RawJourneyEvent {
    #[serde(default)]
    event_id: Option<String>,
    #[serde(default)]
    event_title: Option<String>,
    #[serde(default)]
    event_desc: Option<String>,
    #[serde(default)]
    m_abs: Option<i64>,
    #[serde(default)]
    calendar_id: Option<String>,
    #[serde(default)]
    role: Option<String>,
}

impl RawJourneyEvent {
    fn into_dto(self) -> JourneyEventDto {
        JourneyEventDto {
            event_id: self.event_id.unwrap_or_default(),
            event_title: self.event_title.unwrap_or_else(|| "Событие".to_string()),
            event_desc: self.event_desc,
            m_abs: self.m_abs.unwrap_or(0),
            calendar_id: self.calendar_id,
            role: self.role,
        }
    }
}

#[derive(serde::Deserialize)]
struct RawJourneyRelation {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    target_name: Option<String>,
    #[serde(default)]
    rel_type: Option<String>,
    #[serde(default)]
    strength: Option<i32>,
    #[serde(default)]
    start_order: Option<i32>,
    #[serde(default)]
    end_order: Option<i32>,
}

impl RawJourneyRelation {
    fn into_dto(self) -> JourneyRelationDto {
        JourneyRelationDto {
            id: self.id.unwrap_or_default(),
            target_name: self.target_name.unwrap_or_default(),
            rel_type: self.rel_type.unwrap_or_else(|| "связь".to_string()),
            strength: self.strength.unwrap_or(0),
            start_order: self.start_order,
            end_order: self.end_order,
        }
    }
}

#[derive(serde::Deserialize)]
struct RawJourneyPromise {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    quote: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    planted_order: Option<i32>,
    #[serde(default)]
    resolved_order: Option<i32>,
    #[serde(default)]
    chapter_id: Option<String>,
    #[serde(default)]
    chapter_title: Option<String>,
    #[serde(default)]
    paragraph_index: Option<i64>,
    #[serde(default)]
    block_id: Option<String>,
    #[serde(default)]
    arc_id: Option<String>,
    #[serde(default)]
    arc_title: Option<String>,
    #[serde(default)]
    arc_color: Option<String>,
    #[serde(default)]
    arc_phase: Option<String>,
    #[serde(default)]
    arcs: Option<serde_json::Value>,
    #[serde(default)]
    m_abs: Option<i64>,
    #[serde(default)]
    calendar_id: Option<String>,
    #[serde(default)]
    date_fields: Option<serde_json::Value>,
    #[serde(default)]
    timeline_event_id: Option<String>,
}

impl RawJourneyPromise {
    fn into_dto(self) -> JourneyPromiseDto {
        JourneyPromiseDto {
            id: self.id.unwrap_or_default(),
            title: self.title,
            kind: self.kind.unwrap_or_else(|| "gun".to_string()),
            quote: self.quote.unwrap_or_default(),
            status: self.status.unwrap_or_else(|| "planted".to_string()),
            planted_order: self.planted_order,
            resolved_order: self.resolved_order,
            chapter_id: self.chapter_id,
            chapter_title: self.chapter_title,
            paragraph_index: self.paragraph_index,
            block_id: self.block_id,
            arc_id: self.arc_id,
            arc_title: self.arc_title,
            arc_color: self.arc_color,
            arc_phase: self.arc_phase,
            arcs: self.arcs,
            m_abs: self.m_abs,
            calendar_id: self.calendar_id,
            date_fields: self.date_fields,
            timeline_event_id: self.timeline_event_id,
        }
    }
}

pub(crate) async fn get_character_journey_impl(
    db: &Surreal<Db>,
    project_id: &str,
    entity_id: &str,
) -> Result<CharacterJourneyDto, DomainError> {
    let proj_clean = clean_raw_id!(project_id, "projects");
    let ent_clean = clean_raw_id!(entity_id, "entities");
    let sql = "RETURN fn::get_character_journey(type::record('projects', $p), type::record('entities', $e));";
    let raw: Option<JourneyRaw> = surreal_take_one!(
        db,
        sql,
        ("p", proj_clean),
        ("e", ent_clean),
    )?;

    let raw = raw.unwrap_or(JourneyRaw {
        entity: None,
        appearances: vec![],
        events: vec![],
        relations: vec![],
        promises: vec![],
    });

    let (ent_id, ent_name, ent_type, ent_attrs) = if let Some(info) = raw.entity {
        (
            info.id.unwrap_or_else(|| entity_id.to_string()),
            info.name.unwrap_or_else(|| "Без имени".to_string()),
            info.entity_type.unwrap_or_else(|| "character".to_string()),
            info.attributes,
        )
    } else {
        (
            entity_id.to_string(),
            "Unknown".to_string(),
            "character".to_string(),
            serde_json::json!({}),
        )
    };

    Ok(CharacterJourneyDto {
        entity_id: ent_id,
        entity_name: ent_name,
        entity_type: ent_type,
        attributes: ent_attrs,
        appearances: raw.appearances.into_iter().map(|a| a.into_dto()).collect(),
        events: raw.events.into_iter().map(|e| e.into_dto()).collect(),
        relations: raw.relations.into_iter().map(|r| r.into_dto()).collect(),
        promises: raw.promises.into_iter().map(|p| p.into_dto()).collect(),
    })
}
