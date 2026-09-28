//! SurrealDB implementation of AnalyticsRepositoryPort invoking DDL fn::* stored functions.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, CrossRefMatrixDto, GraphNodeDto, GraphTimeSliceDto, TimelineInspectorDto,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::repositories::AnalyticsRepositoryPort;

pub struct SurrealAnalyticsRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealAnalyticsRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[derive(serde::Deserialize)]
struct RawChapterHeader {
    id: String,
    title: String,
    #[serde(default)]
    sort_order: Option<i32>,
    #[serde(default)]
    word_count: Option<i32>,
}

impl RawChapterHeader {
    fn into_dto(self) -> worldwiki_domain::analytics::ChapterHeaderDto {
        worldwiki_domain::analytics::ChapterHeaderDto {
            id: self.id,
            title: self.title,
            sort_order: self.sort_order.unwrap_or(0),
            word_count: self.word_count.unwrap_or(0),
        }
    }
}

#[derive(serde::Deserialize)]
struct CrossRefRaw {
    chapters: Vec<RawChapterHeader>,
    entities: Vec<RawEntityRow>,
}

#[derive(serde::Deserialize)]
struct RawEntityRow {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    is_deceased: Option<bool>,
    #[serde(default)]
    death_m_abs: Option<i64>,
    #[serde(default)]
    appearances: Vec<RawAppearanceEdge>,
}

#[derive(serde::Deserialize)]
struct RawAppearanceEdge {
    chapter_id: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    role: Option<String>,
}

#[derive(serde::Deserialize)]
struct TimelineRaw {
    events: Vec<RawTimelineEventNode>,
    chapters: Vec<RawChapterHeader>,
}

#[derive(serde::Deserialize)]
struct RawTimelineEventNode {
    id: String,
    title: String,
    description: Option<String>,
    m_abs: i64,
    calendar_id: Option<String>,
    #[serde(default)]
    reveals: Vec<RawTimelineRevealLink>,
    #[serde(default)]
    participants: Vec<RawParticipant>,
}

#[derive(serde::Deserialize)]
struct RawTimelineRevealLink {
    chapter_id: String,
    #[serde(default)]
    chapter_title: Option<String>,
    #[serde(default, alias = "chapter_order")]
    chapter_sort_order: Option<i32>,
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
    fn into_dto(self) -> worldwiki_domain::analytics::TimelineRevealLink {
        worldwiki_domain::analytics::TimelineRevealLink {
            chapter_id: self.chapter_id,
            chapter_title: self.chapter_title.unwrap_or_default(),
            chapter_sort_order: self.chapter_sort_order.unwrap_or(0),
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
    Object { id: String },
    String(String),
}

impl RawParticipant {
    fn into_id(self) -> String {
        match self {
            RawParticipant::Object { id } => id,
            RawParticipant::String(s) => s,
        }
    }
}

#[derive(serde::Deserialize)]
struct GraphRaw {
    nodes: Vec<RawGraphNode>,
    edges: Vec<RawGraphEdge>,
}

#[derive(serde::Deserialize)]
struct RawGraphNode {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    attributes: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct RawGraphEdge {
    id: String,
    source_id: String,
    target_id: String,
    rel_type: String,
    description: Option<String>,
    strength: Option<i64>,
    start_chapter: Option<String>,
    start_order: Option<i32>,
    end_chapter: Option<String>,
    end_order: Option<i32>,
    inferred_start_m_abs: Option<i64>,
}

#[derive(serde::Deserialize)]
struct JourneyRaw {
    entity: Option<RawJourneyEntityInfo>,
    #[serde(default)]
    appearances: Vec<worldwiki_domain::analytics::JourneyAppearanceDto>,
    #[serde(default)]
    events: Vec<worldwiki_domain::analytics::JourneyEventDto>,
    #[serde(default)]
    relations: Vec<worldwiki_domain::analytics::JourneyRelationDto>,
    #[serde(default)]
    promises: Vec<worldwiki_domain::analytics::JourneyPromiseDto>,
}

#[derive(serde::Deserialize)]
struct RawJourneyEntityInfo {
    id: String,
    name: String,
    entity_type: String,
    #[serde(default)]
    attributes: serde_json::Value,
}

#[async_trait]
impl AnalyticsRepositoryPort for SurrealAnalyticsRepository {
    async fn get_cross_reference_matrix(
        &self,
        project_id: &str,
    ) -> Result<CrossRefMatrixDto, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let sql = "RETURN fn::get_cross_reference_matrix(type::record('projects', $p));";
        let mut res = self
            .db
            .query(sql)
            .bind(("p", proj_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw: Option<CrossRefRaw> = super::helpers::take_one(&mut res, 0)?;
        let raw = raw.unwrap_or(CrossRefRaw {
            chapters: vec![],
            entities: vec![],
        });

        let mut entities_dto = Vec::new();
        let mut warnings = Vec::new();

        for ent in raw.entities {
            let mut apps_by_chap = Vec::new();
            let mut last_seen_order = 0;
            let mut appeared_in_any = false;

            for ch in &raw.chapters {
                let found_app = ent.appearances.iter().find(|a| {
                    a.chapter_id == ch.id
                        || a.chapter_id.trim_start_matches("chapters:")
                            == ch.id.trim_start_matches("chapters:")
                });

                let ch_order = ch.sort_order.unwrap_or(0);

                let (kind, src, role) =
                    if ent.is_deceased.unwrap_or(false) && ent.death_m_abs.is_some() {
                        (
                            worldwiki_domain::analytics::CellAppearanceKind::Deceased,
                            None,
                            None,
                        )
                    } else if let Some(app) = found_app {
                        appeared_in_any = true;
                        last_seen_order = ch_order;
                        let k = if app.source.as_deref() == Some("scene") {
                            worldwiki_domain::analytics::CellAppearanceKind::Scene
                        } else {
                            worldwiki_domain::analytics::CellAppearanceKind::Mention
                        };
                        (k, app.source.clone(), app.role.clone())
                    } else {
                        (
                            worldwiki_domain::analytics::CellAppearanceKind::None,
                            None,
                            None,
                        )
                    };

                apps_by_chap.push(worldwiki_domain::analytics::CellAppearanceDto {
                    chapter_id: ch.id.clone(),
                    kind,
                    source: src,
                    role,
                });
            }

            if appeared_in_any && !raw.chapters.is_empty() {
                let latest_order = raw.chapters.last().and_then(|c| c.sort_order).unwrap_or(0);
                let gap = (latest_order - last_seen_order) as usize;
                if gap >= 3 {
                    warnings.push(worldwiki_domain::analytics::AbsenceWarningDto {
                        entity_id: ent.id.clone(),
                        entity_name: ent.name.clone(),
                        missing_since_chapter_id: raw
                            .chapters
                            .iter()
                            .find(|c| c.sort_order.unwrap_or(0) == last_seen_order)
                            .map(|c| c.id.clone())
                            .unwrap_or_default(),
                        missing_since_order: last_seen_order,
                        skipped_chapters_count: gap,
                    });
                }
            }

            entities_dto.push(worldwiki_domain::analytics::EntityRowDto {
                id: ent.id,
                name: ent.name,
                entity_type: ent.entity_type,
                is_deceased: ent.is_deceased.unwrap_or(false),
                death_m_abs: ent.death_m_abs,
                appearances_by_chapter: apps_by_chap,
            });
        }

        Ok(CrossRefMatrixDto {
            chapters: raw.chapters.into_iter().map(|c| c.into_dto()).collect(),
            entities: entities_dto,
            absence_warnings: warnings,
        })
    }

    async fn get_timeline_inspector_data(
        &self,
        project_id: &str,
    ) -> Result<TimelineInspectorDto, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let sql = "RETURN fn::get_timeline_inspector_data(type::record('projects', $p));";
        let mut res = self
            .db
            .query(sql)
            .bind(("p", proj_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw: Option<TimelineRaw> = super::helpers::take_one(&mut res, 0)?;

        let raw = raw.unwrap_or(TimelineRaw {
            events: vec![],
            chapters: vec![],
        });

        println!("[CHRONOINSPECTOR_LOG] Fetched data for project {}. Events count: {}, Chapters count: {}", project_id, raw.events.len(), raw.chapters.len());
        for (i, ev) in raw.events.iter().enumerate() {
            println!("[CHRONOINSPECTOR_LOG] Event {}: id={}, title={}, m_abs={}, reveals={}, participants={}", 
                i, ev.id, ev.title, ev.m_abs, ev.reveals.len(), ev.participants.len());
        }

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

            event_nodes.push(worldwiki_domain::analytics::TimelineInspectorEventNode {
                event_id: ev.id,
                title: ev.title,
                description: ev.description,
                m_abs: ev.m_abs,
                calendar_id: ev.calendar_id.unwrap_or_default(),
                participants: ev.participants.into_iter().map(|p| p.into_id()).collect(),
                reveals: reveals_dto,
            });
        }

        Ok(TimelineInspectorDto {
            events: event_nodes,
            chapters: raw.chapters.into_iter().map(|c| c.into_dto()).collect(),
            entity_swimlanes: Vec::new(),
            detected_crossings: crossings_count,
        })
    }

    async fn get_graph_time_slice(
        &self,
        project_id: &str,
    ) -> Result<GraphTimeSliceDto, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let sql = "RETURN fn::get_graph_time_slice(type::record('projects', $p));";
        let mut res = self
            .db
            .query(sql)
            .bind(("p", proj_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw: Option<GraphRaw> = super::helpers::take_one(&mut res, 0)?;

        let raw = raw.unwrap_or(GraphRaw {
            nodes: vec![],
            edges: vec![],
        });

        let nodes_dto = raw
            .nodes
            .into_iter()
            .map(|n| GraphNodeDto {
                id: n.id,
                name: n.name,
                entity_type: n.entity_type,
                tags: n.tags,
                attributes: n.attributes,
                x: 0.0,
                y: 0.0,
            })
            .collect();

        let mut edges_dto = Vec::new();
        for e in raw.edges {
            let needs_warning = e.start_chapter.is_some() && e.inferred_start_m_abs.is_none();
            edges_dto.push(worldwiki_domain::analytics::DirectedRelationshipEdgeDto {
                id: e.id,
                source_id: e.source_id,
                target_id: e.target_id,
                rel_type: e.rel_type,
                description: e.description,
                strength: e.strength.unwrap_or(0) as i32,
                is_directed: true,
                start_chapter_id: e.start_chapter,
                start_chapter_order: e.start_order,
                end_chapter_id: e.end_chapter,
                end_chapter_order: e.end_order,
                start_m_abs: e.inferred_start_m_abs,
                end_m_abs: None,
                needs_m_abs_warning: needs_warning,
                is_revealed_to_reader: true,
                offset_px: 6.0,
            });
        }

        Ok(GraphTimeSliceDto {
            nodes: nodes_dto,
            edges: edges_dto,
        })
    }

    async fn get_character_journey(
        &self,
        project_id: &str,
        entity_id: &str,
    ) -> Result<CharacterJourneyDto, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let ent_clean = entity_id.trim_start_matches("entities:");
        let sql = "RETURN fn::get_character_journey(type::record('projects', $p), type::record('entities', $e));";
        let mut res = self
            .db
            .query(sql)
            .bind(("p", proj_clean.to_string()))
            .bind(("e", ent_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw: Option<JourneyRaw> = super::helpers::take_one(&mut res, 0)?;

        let raw = raw.unwrap_or(JourneyRaw {
            entity: None,
            appearances: vec![],
            events: vec![],
            relations: vec![],
            promises: vec![],
        });

        let (ent_id, ent_name, ent_type, ent_attrs) = if let Some(info) = raw.entity {
            (info.id, info.name, info.entity_type, info.attributes)
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
            appearances: raw.appearances,
            events: raw.events,
            relations: raw.relations,
            promises: raw.promises,
        })
    }
}
