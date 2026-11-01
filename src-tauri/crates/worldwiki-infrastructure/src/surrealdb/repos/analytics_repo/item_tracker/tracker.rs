use super::types::{RawEntity, RawEvent, RawItemTrackerBundle, RawPromise, clean_id};
use std::collections::HashMap;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::analytics::{
    CustodyEventDto, ItemTrackerDto, ItemTrackerSummaryDto, ItemUsageState, TrackedItemDto,
};
use worldwiki_domain::errors::DomainError;

#[derive(Default)]
struct ItemStatusCounts {
    active_count: usize,
    sleeping_count: usize,
    forgotten_count: usize,
    destroyed_count: usize,
}

pub(crate) async fn get_item_tracker_impl(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<ItemTrackerDto, DomainError> {
    let proj_clean = clean_raw_id!(project_id, "projects");
    let sql = "RETURN fn::get_item_tracker(type::record('projects', $p));";
    let bundle: Option<RawItemTrackerBundle> = surreal_take_one!(db, sql, ("p", proj_clean))?;
    let bundle = bundle.unwrap_or_default();

    let all_entities = bundle.entities;
    let chapters = bundle.chapters;
    let promises = bundle.promises;
    let events = bundle.events;

    let max_chapter_order = chapters
        .iter()
        .map(|c| c.sort_order.unwrap_or(0))
        .max()
        .unwrap_or(1);

    let chapter_map: HashMap<String, (i32, String)> = chapters
        .into_iter()
        .map(|c| {
            (
                clean_id(&c.id).to_string(),
                (c.sort_order.unwrap_or(0), c.title.unwrap_or_default()),
            )
        })
        .collect();

    let mut character_names = HashMap::new();
    let mut item_entities: Vec<RawEntity> = Vec::new();

    for ent in all_entities {
        let ent_type = ent.entity_type.as_deref().unwrap_or("unknown");
        if ent_type == "character" {
            character_names.insert(clean_id(&ent.id).to_string(), ent.name.unwrap_or_default());
        } else if ent_type == "item" {
            item_entities.push(ent);
        }
    }

    let mut counts = ItemStatusCounts::default();
    let mut tracked_items = process_item_entities(
        item_entities,
        &character_names,
        &chapter_map,
        &promises,
        &events,
        max_chapter_order,
        &mut counts,
    );

    process_narrative_guns(
        &promises,
        &character_names,
        &chapter_map,
        max_chapter_order,
        &mut tracked_items,
        &mut counts,
    );

    let summary = ItemTrackerSummaryDto {
        total_items: tracked_items.len(),
        active_count: counts.active_count,
        sleeping_count: counts.sleeping_count,
        forgotten_count: counts.forgotten_count,
        destroyed_count: counts.destroyed_count,
    };

    Ok(ItemTrackerDto {
        summary,
        items: tracked_items,
    })
}

fn process_item_entities(
    item_entities: Vec<RawEntity>,
    character_names: &HashMap<String, String>,
    chapter_map: &HashMap<String, (i32, String)>,
    promises: &[RawPromise],
    events: &[RawEvent],
    max_chapter_order: i32,
    counts: &mut ItemStatusCounts,
) -> Vec<TrackedItemDto> {
    let mut tracked_items = Vec::new();

    for item in item_entities {
        let item_clean = clean_id(&item.id);
        let attrs = &item.attributes;

        let item_type = attrs
            .get("тип_предмета")
            .or_else(|| attrs.get("itemType"))
            .and_then(|v| v.as_str())
            .unwrap_or("артефакт")
            .to_string();

        let status_category = attrs
            .get("статус_категория")
            .or_else(|| attrs.get("itemStatus"))
            .and_then(|v| v.as_str())
            .unwrap_or("Цел / Активен")
            .to_string();

        let owner_raw = attrs
            .get("текущий_владелец")
            .or_else(|| attrs.get("itemOwner"))
            .and_then(|v| v.as_str());

        let (current_owner_id, current_owner_name) = if let Some(owner) = owner_raw {
            let o_clean = clean_id(owner);
            let o_name = character_names
                .get(o_clean)
                .map(|s| s.as_str())
                .unwrap_or(owner)
                .to_string();
            (Some(owner.to_string()), Some(o_name))
        } else {
            (None, None)
        };

        let mut custody_chain = Vec::new();
        if let Some(history) = attrs.get("история_владения").and_then(|h| h.as_array())
        {
            for entry in history {
                let owner_val = entry
                    .get("название")
                    .or_else(|| entry.get("owner"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let o_clean = clean_id(owner_val);
                let o_name = character_names
                    .get(o_clean)
                    .map(|s| s.as_str())
                    .unwrap_or(owner_val)
                    .to_string();
                let circ = entry
                    .get("описание_1")
                    .or_else(|| entry.get("circumstances"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let status_stage = entry
                    .get("статус_категория")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let m_abs = entry.get("m_abs").and_then(|v| v.as_i64());

                custody_chain.push(CustodyEventDto {
                    owner_id: if owner_val.is_empty() {
                        None
                    } else {
                        Some(owner_val.to_string())
                    },
                    owner_name: if o_name.is_empty() {
                        None
                    } else {
                        Some(o_name)
                    },
                    chapter_id: None,
                    chapter_order: None,
                    chapter_title: None,
                    m_abs,
                    circumstances: circ,
                    status_on_stage: status_stage,
                });
            }
        }

        let mut appearance_chapter_orders = Vec::new();

        for prom in promises {
            let matches = prom
                .participant_ids
                .iter()
                .any(|p| clean_id(p) == item_clean);
            if matches && let Some(ref c_id) = prom.chapter_id {
                let clean_cid = clean_id(c_id);
                if let Some((order, _)) = chapter_map.get(clean_cid) {
                    appearance_chapter_orders.push(*order);
                }
            }
        }

        for ev in events {
            let matches = ev.participants.iter().any(|p| clean_id(p) == item_clean);
            if matches && let Some(ref c_id) = ev.chapter_id {
                let clean_cid = clean_id(c_id);
                if let Some((order, _)) = chapter_map.get(clean_cid) {
                    appearance_chapter_orders.push(*order);
                }
            }
        }

        appearance_chapter_orders.sort_unstable();
        let total_mentions = appearance_chapter_orders.len();
        let first_chapter_order = appearance_chapter_orders.first().copied();
        let last_chapter_order = appearance_chapter_orders.last().copied();

        let is_destroyed_or_lost = status_category.contains("Уничтожен")
            || status_category.contains("Утерян")
            || status_category.contains("уничтожен")
            || status_category.contains("утерян");

        let skipped_chapters = if let Some(last_order) = last_chapter_order {
            (max_chapter_order - last_order).max(0)
        } else {
            0
        };

        let usage_state = if is_destroyed_or_lost {
            counts.destroyed_count += 1;
            ItemUsageState::DestroyedOrLost
        } else if total_mentions == 0 {
            counts.sleeping_count += 1;
            ItemUsageState::Sleeping
        } else if skipped_chapters >= 10 {
            counts.forgotten_count += 1;
            ItemUsageState::Forgotten
        } else if skipped_chapters >= 5 {
            counts.sleeping_count += 1;
            ItemUsageState::Sleeping
        } else {
            counts.active_count += 1;
            ItemUsageState::Active
        };

        tracked_items.push(TrackedItemDto {
            id: item.id,
            name: item.name.unwrap_or_default(),
            item_type,
            status_category,
            current_owner_id,
            current_owner_name,
            first_chapter_order,
            last_chapter_order,
            skipped_chapters,
            total_mentions,
            usage_state,
            custody_chain,
        });
    }

    tracked_items
}

fn process_narrative_guns(
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
    let current_owner_name = current_owner_id.as_deref().map(|id| {
        let o_clean = clean_id(id);
        character_names
            .get(o_clean)
            .map(|s| s.as_str())
            .unwrap_or(id)
            .to_string()
    });

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
