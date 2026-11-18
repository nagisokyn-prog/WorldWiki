//! Multi-Character Journey analytics and cross-arc navigation.

mod dto_builder;

use dto_builder::{
    MultiJourneyCleanAppearance, MultiJourneyCleanEntity, MultiJourneyRawData,
    MultiJourneyRawPromise, build_participant_dto,
};
use std::collections::{HashMap, HashSet};
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::analytics::{
    JourneyFilterMode, JourneyMeetingGapDto, MultiJourneyResponseDto, MultiJourneySceneDto,
};
use worldwiki_domain::errors::DomainError;

struct ChapterGroup<'a> {
    chapter_id: &'a str,
    chapter_title: &'a str,
    volume_title: Option<&'a str>,
    chapter_order: i32,
    participants: Vec<&'a MultiJourneyCleanAppearance>,
}

fn build_entity_map(
    entities: &[MultiJourneyCleanEntity],
) -> HashMap<&str, &MultiJourneyCleanEntity> {
    let mut map = HashMap::with_capacity(entities.len() * 3);
    for ent in entities {
        map.insert(ent.id.as_str(), ent);
        map.insert(ent.id.trim_start_matches("entities:"), ent);
        map.insert(ent.name.as_str(), ent);
    }
    map
}

fn group_appearances_by_chapter<'a>(
    appearances: &'a [MultiJourneyCleanAppearance],
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
    let proj_clean = clean_raw_id!(project_id, "projects");
    let entity_records: Vec<String> = entity_ids
        .iter()
        .map(|id| format!("entities:{}", clean_raw_id!(id, "entities")))
        .collect();

    let sql = "RETURN fn::get_multi_character_journey(type::record('projects', $p), $ents);";
    let raw: Option<MultiJourneyRawData> = surreal_take_one!(
        db,
        sql,
        ("p", proj_clean),
        ("ents", entity_records),
    )?;
    let raw = raw.unwrap_or(MultiJourneyRawData {
        entities: Vec::new(),
        appearances: Vec::new(),
        promises: Vec::new(),
    });

    let clean_entities: Vec<MultiJourneyCleanEntity> =
        raw.entities.into_iter().map(|e| e.clean()).collect();
    let clean_appearances: Vec<MultiJourneyCleanAppearance> =
        raw.appearances.into_iter().map(|a| a.clean()).collect();

    let entity_map = build_entity_map(&clean_entities);
    let chapter_groups = group_appearances_by_chapter(&clean_appearances);

    let mut scenes = Vec::with_capacity(chapter_groups.len());

    for (_ch_id, grp) in chapter_groups {
        let mut ch_promises: Vec<&MultiJourneyRawPromise> = Vec::new();
        for p in &raw.promises {
            if let Some(ref cid) = p.chapter_id
                && (cid == grp.chapter_id
                    || cid.trim_start_matches("chapters:")
                        == grp.chapter_id.trim_start_matches("chapters:"))
            {
                ch_promises.push(p);
            }
        }

        let scene_m_abs = ch_promises.iter().find_map(|p| p.m_abs);
        let scene_quote = ch_promises.iter().find_map(|p| p.quote.clone());
        let scene_block_id = ch_promises.iter().find_map(|p| p.block_id.clone());
        let scene_para_idx = ch_promises.iter().find_map(|p| p.paragraph_index);
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
                quote: scene_quote,
                block_id: scene_block_id,
                paragraph_index: scene_para_idx,
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
