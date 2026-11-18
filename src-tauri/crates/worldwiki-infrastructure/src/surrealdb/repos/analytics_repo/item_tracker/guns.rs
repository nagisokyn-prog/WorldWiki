use super::tracker::ItemStatusCounts;
use super::types::{RawPromise, clean_id};
use std::collections::HashMap;
use worldwiki_domain::analytics::{CustodyEventDto, ItemUsageState, TrackedItemDto};

pub(super) fn process_narrative_guns(
    promises: &[RawPromise],
    character_names: &HashMap<String, String>,
    chapter_map: &HashMap<String, (i32, String)>,
    max_chapter_order: i32,
    tracked_items: &mut Vec<TrackedItemDto>,
    counts: &mut ItemStatusCounts,
) {
    for prom in promises {
        let is_gun =
            prom.kind.as_deref() == Some("gun") || prom.kind.as_deref() == Some("foreshadowing");
        if !is_gun {
            continue;
        }

        let prom_clean = clean_id(&prom.id);
        if tracked_items.iter().any(|t| clean_id(&t.id) == prom_clean) {
            continue;
        }

        let item = build_gun_tracked_item(
            prom,
            character_names,
            chapter_map,
            max_chapter_order,
            counts,
        );
        tracked_items.push(item);
    }
}

fn build_gun_tracked_item(
    prom: &RawPromise,
    character_names: &HashMap<String, String>,
    chapter_map: &HashMap<String, (i32, String)>,
    max_chapter_order: i32,
    counts: &mut ItemStatusCounts,
) -> TrackedItemDto {
    let first_ch_order = prom
        .chapter_id
        .as_ref()
        .and_then(|c_id| chapter_map.get(clean_id(c_id)))
        .map(|(ord, _)| *ord);

    let last_ch_order = prom
        .resolved_at_chapter_id
        .as_ref()
        .and_then(|c_id| chapter_map.get(clean_id(c_id)))
        .map(|(ord, _)| *ord)
        .or(first_ch_order);

    let skipped_chapters = if let Some(last_order) = last_ch_order {
        (max_chapter_order - last_order).max(0)
    } else {
        0
    };

    let raw_status = prom.status.as_deref().unwrap_or("active");
    let (status_category, usage_state) = match raw_status {
        "fired" | "resolved" => {
            counts.active_count += 1;
            ("Выстрелило", ItemUsageState::Active)
        }
        "broken" | "dropped" => {
            counts.destroyed_count += 1;
            ("Сорвано / Утеряно", ItemUsageState::DestroyedOrLost)
        }
        _ => {
            if skipped_chapters >= 10 {
                counts.forgotten_count += 1;
                ("Забыто (10+ глав)", ItemUsageState::Forgotten)
            } else if skipped_chapters >= 5 {
                counts.sleeping_count += 1;
                ("В ожидании (5+ глав)", ItemUsageState::Sleeping)
            } else {
                counts.active_count += 1;
                ("Заряжено", ItemUsageState::Active)
            }
        }
    };

    let current_owner_id = prom.participant_ids.first().map(|s| s.to_string());
    let current_owner_name = match current_owner_id.as_deref() {
        Some(id) => {
            let o_clean = clean_id(id);
            Some(
                character_names
                    .get(o_clean)
                    .map(|s| s.as_str())
                    .unwrap_or(id)
                    .to_string(),
            )
        }
        None => None,
    };

    let custody_chain = build_gun_custody(
        prom.chapter_id.as_deref(),
        current_owner_id.as_deref(),
        current_owner_name.as_deref(),
        chapter_map,
        prom.m_abs,
        prom.description.as_deref(),
        status_category,
    );

    let item_type = if prom.kind.as_deref() == Some("foreshadowing") {
        "Предзнаменование".to_string()
    } else {
        "Чеховское ружьё".to_string()
    };

    TrackedItemDto {
        id: prom.id.clone(),
        name: prom
            .title
            .as_deref()
            .unwrap_or("Чеховское ружьё")
            .to_string(),
        item_type,
        status_category: status_category.to_string(),
        current_owner_id,
        current_owner_name,
        first_chapter_order: first_ch_order,
        last_chapter_order: last_ch_order,
        skipped_chapters,
        total_mentions: if prom.resolved_at_chapter_id.is_some() {
            2
        } else {
            1
        },
        usage_state,
        custody_chain,
    }
}

fn build_gun_custody(
    chapter_id: Option<&str>,
    owner_id: Option<&str>,
    owner_name: Option<&str>,
    chapter_map: &HashMap<String, (i32, String)>,
    m_abs: Option<i64>,
    desc: Option<&str>,
    status_category: &str,
) -> Vec<CustodyEventDto> {
    let mut custody_chain = Vec::new();
    if let Some(ch_id) = chapter_id {
        let clean_cid = clean_id(ch_id);
        let (order, title) = if let Some((o, t)) = chapter_map.get(clean_cid) {
            (Some(*o), Some(t.to_string()))
        } else {
            (None, None)
        };

        custody_chain.push(CustodyEventDto {
            owner_id: owner_id.map(str::to_string),
            owner_name: owner_name.map(str::to_string),
            chapter_id: Some(ch_id.to_string()),
            chapter_order: order,
            chapter_title: title,
            m_abs,
            circumstances: desc.unwrap_or_default().to_string(),
            status_on_stage: Some(status_category.to_string()),
        });
    }
    custody_chain
}
