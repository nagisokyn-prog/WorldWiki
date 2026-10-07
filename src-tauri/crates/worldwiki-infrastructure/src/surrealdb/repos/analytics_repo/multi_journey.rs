//! Multi-Character Journey analytics and cross-arc navigation.

use std::collections::{HashMap, HashSet};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    JourneyFilterMode, JourneyMeetingGapDto, JourneyParticipantArcDto, JourneyParticipantDto,
    MultiJourneyResponseDto, MultiJourneySceneDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawEntity {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub attributes: serde_json::Value,
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawAppearance {
    pub entity_id: String,
    pub entity_name: String,
    pub chapter_id: String,
    pub chapter_title: String,
    #[serde(default)]
    pub volume_title: Option<String>,
    #[serde(default)]
    pub chapter_order: i32,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawPromise {
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub arc_id: Option<String>,
    #[serde(default)]
    pub arc_title: Option<String>,
    #[serde(default)]
    pub arc_phase: Option<String>,
    #[serde(default)]
    pub arc_color: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participant_ids: Option<Vec<String>>,
}

impl MultiJourneyRawPromise {
    fn to_arc_dto(&self) -> Option<JourneyParticipantArcDto> {
        let arc_id = self.arc_id.as_ref()?;
        let arc_title = self.arc_title.as_ref()?;
        Some(JourneyParticipantArcDto {
            arc_id: arc_id.clone(),
            arc_title: arc_title.clone(),
            arc_phase: self.arc_phase.clone(),
            color: self.arc_color.clone(),
        })
    }

    fn matches_participant(&self, part: &MultiJourneyRawAppearance) -> bool {
        self.participant_ids
            .as_ref()
            .map(|ids| {
                ids.iter().any(|id| {
                    id == &part.entity_id
                        || id == &part.entity_name
                        || id == part.entity_id.trim_start_matches("entities:")
                })
            })
            .unwrap_or(true)
    }
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct MultiJourneyRawData {
    #[serde(default)]
    pub entities: Vec<MultiJourneyRawEntity>,
    #[serde(default)]
    pub appearances: Vec<MultiJourneyRawAppearance>,
    #[serde(default)]
    pub promises: Vec<MultiJourneyRawPromise>,
}

struct ChapterGroup<'a> {
    chapter_id: &'a str,
    chapter_title: &'a str,
    volume_title: Option<&'a str>,
    chapter_order: i32,
    participants: Vec<&'a MultiJourneyRawAppearance>,
}

fn build_entity_map(
    entities: &[MultiJourneyRawEntity],
) -> HashMap<&str, &MultiJourneyRawEntity> {
    let mut map = HashMap::with_capacity(entities.len() * 3);
    for ent in entities {
        map.insert(ent.id.as_str(), ent);
        map.insert(ent.id.trim_start_matches("entities:"), ent);
        map.insert(ent.name.as_str(), ent);
    }
    map
}

fn group_appearances_by_chapter<'a>(
    appearances: &'a [MultiJourneyRawAppearance],
) -> HashMap<&'a str, ChapterGroup<'a>> {
    let mut groups = HashMap::new();
    for app in appearances {
        let entry = groups
            .entry(app.chapter_id.as_str())
            .or_insert_with(|| ChapterGroup {
                chapter_id: app.chapter_id.as_str(),
                chapter_title: app.chapter_title.as_str(),
                volume_title: app.volume_title.as_deref(),
                chapter_order: app.chapter_order,
                participants: Vec::new(),
            });
        if !entry.participants.iter().any(|p| p.entity_id == app.entity_id) {
            entry.participants.push(app);
        }
    }
    groups
}

fn extract_participant_arcs(
    part: &MultiJourneyRawAppearance,
    promises: &[&MultiJourneyRawPromise],
) -> Vec<JourneyParticipantArcDto> {
    let mut arcs_set = HashSet::new();
    let mut arcs = Vec::new();

    for p in promises {
        if p.matches_participant(part)
            && let Some(arc_id) = p.arc_id.as_deref()
                && arcs_set.insert(arc_id)
                    && let Some(dto) = p.to_arc_dto() {
                        arcs.push(dto);
                    }
    }
    arcs
}

fn calculate_diegetic_age(birth_m_abs: Option<i64>, scene_m_abs: Option<i64>) -> Option<String> {
    match (birth_m_abs, scene_m_abs) {
        (Some(birth), Some(scene)) if scene >= birth => {
            let delta_min = scene - birth;
            let years = delta_min / 525_600;
            if years > 0 {
                Some(format!("{} лет", years))
            } else {
                Some("Младше года".to_string())
            }
        }
        (Some(_), Some(_)) => Some("До рождения".to_string()),
        _ => None,
    }
}

fn build_participant_dto(
    part: &MultiJourneyRawAppearance,
    ent_info: Option<&&MultiJourneyRawEntity>,
    promises: &[&MultiJourneyRawPromise],
    scene_m_abs: Option<i64>,
) -> JourneyParticipantDto {
    let role_in_story = ent_info
        .and_then(|e| e.attributes.get("роль_в_истории"))
        .and_then(|v| v.as_str())
        .map(ToString::to_string)
        .or_else(|| part.role.clone());

    let status_category = ent_info
        .and_then(|e| e.attributes.get("статус_категория"))
        .and_then(|v| v.as_str())
        .map(ToString::to_string);

    let birth_m_abs = ent_info
        .and_then(|e| e.attributes.get("дата_рождения"))
        .and_then(|d| d.get("absolute_minute"))
        .and_then(|v| v.as_i64());

    let death_m_abs = ent_info
        .and_then(|e| e.attributes.get("дата_смерти"))
        .and_then(|d| d.get("absolute_minute"))
        .and_then(|v| v.as_i64());

    let is_before_birth = match (birth_m_abs, scene_m_abs) {
        (Some(birth), Some(scene)) => scene < birth,
        _ => false,
    };

    let is_deceased = status_category.as_deref() == Some("Мёртв")
        || match (death_m_abs, scene_m_abs) {
            (Some(death), Some(scene)) => scene > death,
            _ => false,
        };

    let age_label = calculate_diegetic_age(birth_m_abs, scene_m_abs);
    let arcs = extract_participant_arcs(part, promises);

    JourneyParticipantDto {
        entity_id: part.entity_id.clone(),
        entity_name: part.entity_name.clone(),
        role_in_story,
        status_category,
        age_label,
        is_before_birth,
        is_deceased,
        arcs,
    }
}

fn calculate_meeting_gaps(scenes: &mut [MultiJourneySceneDto]) {
    let mut prev_meta: Option<(i32, Option<i64>)> = None;
    for scene in scenes {
        if let Some((prev_order, prev_m_abs)) = prev_meta {
            let gap = scene.sort_order - prev_order - 1;
            if gap > 0 {
                let min_delta = match (prev_m_abs, scene.scene_m_abs) {
                    (Some(t1), Some(t2)) if t2 > t1 => Some(t2 - t1),
                    _ => None,
                };
                let formatted = format!("⏳ Не виделись {} глав", gap);
                scene.meeting_gap = Some(JourneyMeetingGapDto {
                    chapters_count: gap,
                    minutes_delta: min_delta,
                    formatted_label: formatted,
                });
            }
        }
        prev_meta = Some((scene.sort_order, scene.scene_m_abs));
    }
}

pub(crate) async fn get_multi_character_journey_impl(
    db: &Surreal<Db>,
    project_id: &str,
    entity_ids: &[String],
    mode: JourneyFilterMode,
) -> Result<MultiJourneyResponseDto, DomainError> {
    let proj_clean = project_id.trim_start_matches("projects:");
    let entity_records: Vec<String> = entity_ids
        .iter()
        .map(|id| format!("entities:{}", id.trim_start_matches("entities:")))
        .collect();

    let sql = "RETURN fn::get_multi_character_journey(type::record('projects', $p), $ents);";
    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .bind(("ents", entity_records))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let raw: Option<MultiJourneyRawData> = crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;
    let raw = raw.unwrap_or(MultiJourneyRawData {
        entities: Vec::new(),
        appearances: Vec::new(),
        promises: Vec::new(),
    });

    let entity_map = build_entity_map(&raw.entities);
    let chapter_groups = group_appearances_by_chapter(&raw.appearances);

    let mut scenes = Vec::with_capacity(chapter_groups.len());

    for (_ch_id, grp) in chapter_groups {
        let ch_promises: Vec<&MultiJourneyRawPromise> = raw
            .promises
            .iter()
            .filter(|p| p.chapter_id.as_deref() == Some(grp.chapter_id))
            .collect();

        let scene_m_abs = ch_promises.iter().find_map(|p| p.m_abs);
        let mut present_entities = Vec::with_capacity(grp.participants.len());

        for part in &grp.participants {
            let ent_info = entity_map.get(part.entity_id.as_str());
            present_entities.push(build_participant_dto(
                part,
                ent_info,
                &ch_promises,
                scene_m_abs,
            ));
        }

        let include_scene = match mode {
            JourneyFilterMode::Union => !present_entities.is_empty(),
            JourneyFilterMode::Intersection => {
                let present_ids: HashSet<&str> = present_entities
                    .iter()
                    .map(|p| p.entity_id.trim_start_matches("entities:"))
                    .collect();
                entity_ids
                    .iter()
                    .all(|id| present_ids.contains(id.trim_start_matches("entities:")))
            }
        };

        if include_scene {
            scenes.push(MultiJourneySceneDto {
                id: format!("scene_{}", grp.chapter_id),
                item_type: "chapter".to_string(),
                chapter_id: Some(grp.chapter_id.to_string()),
                chapter_title: Some(grp.chapter_title.to_string()),
                volume_title: grp.volume_title.map(ToString::to_string),
                sort_order: grp.chapter_order,
                scene_m_abs,
                scene_date_formatted: None,
                present_entities,
                meeting_gap: None,
            });
        }
    }

    scenes.sort_by_key(|s| s.sort_order);
    calculate_meeting_gaps(&mut scenes);

    Ok(MultiJourneyResponseDto {
        total_scenes: scenes.len(),
        filter_mode: mode,
        requested_entity_ids: entity_ids.to_vec(),
        scenes,
    })
}
