use super::types::{clean_id, RawEntity, RawItemTrackerBundle};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    CustodyEventDto, ItemTrackerDto, ItemTrackerSummaryDto, ItemUsageState, TrackedItemDto,
};
use worldwiki_domain::errors::DomainError;

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

    // Map chapter id -> (sort_order, title)
    let chapter_map: std::collections::HashMap<String, (i32, String)> = chapters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), (c.sort_order.unwrap_or(0), c.title.unwrap_or_default())))
        .collect();

    let mut character_names = std::collections::HashMap::new();
    let mut item_entities: Vec<RawEntity> = Vec::new();

    for ent in all_entities {
        let ent_type = ent.entity_type.as_deref().unwrap_or("unknown");
        let ent_name = ent.name.clone().unwrap_or_default();
        if ent_type == "character" {
            character_names.insert(clean_id(&ent.id).to_string(), ent_name);
        } else if ent_type == "item" {
            item_entities.push(ent);
        }
    }

    let mut tracked_items = Vec::new();
    let mut active_count = 0;
    let mut sleeping_count = 0;
    let mut forgotten_count = 0;
    let mut destroyed_count = 0;

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
                .cloned()
                .unwrap_or_else(|| owner.to_string());
            (Some(owner.to_string()), Some(o_name))
        } else {
            (None, None)
        };

        // Extract custody chain from attributes.история_владения if present
        let mut custody_chain = Vec::new();
        if let Some(history) = attrs.get("история_владения").and_then(|h| h.as_array()) {
            for entry in history {
                let owner_val = entry
                    .get("название")
                    .or_else(|| entry.get("owner"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let o_clean = clean_id(owner_val);
                let o_name = character_names
                    .get(o_clean)
                    .cloned()
                    .unwrap_or_else(|| owner_val.to_string());
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

        // Find appearances in promises and events
        let mut appearance_chapter_orders = Vec::new();

        for prom in &promises {
            let matches = prom
                .participant_ids
                .iter()
                .any(|p| clean_id(p) == item_clean);
            if matches
                && let Some(ref c_id) = prom.chapter_id {
                    let clean_cid = clean_id(c_id);
                    if let Some((order, _)) = chapter_map.get(clean_cid) {
                        appearance_chapter_orders.push(*order);
                    }
                }
        }

        for ev in &events {
            let matches = ev.participants.iter().any(|p| clean_id(p) == item_clean);
            if matches
                && let Some(ref c_id) = ev.chapter_id {
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
            destroyed_count += 1;
            ItemUsageState::DestroyedOrLost
        } else if total_mentions == 0 {
            sleeping_count += 1;
            ItemUsageState::Sleeping
        } else if skipped_chapters >= 10 {
            forgotten_count += 1;
            ItemUsageState::Forgotten
        } else if skipped_chapters >= 5 {
            sleeping_count += 1;
            ItemUsageState::Sleeping
        } else {
            active_count += 1;
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

    // Include narrative promises of kind "gun" or "foreshadowing"
    for prom in &promises {
        let is_gun = prom.kind.as_deref() == Some("gun") || prom.kind.as_deref() == Some("foreshadowing");
        if !is_gun {
            continue;
        }

        let prom_clean = clean_id(&prom.id);
        if tracked_items.iter().any(|t| clean_id(&t.id) == prom_clean) {
            continue;
        }

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
                active_count += 1;
                ("Выстрелило", ItemUsageState::Active)
            }
            "broken" | "dropped" => {
                destroyed_count += 1;
                ("Сорвано / Утеряно", ItemUsageState::DestroyedOrLost)
            }
            _ => {
                if skipped_chapters >= 10 {
                    forgotten_count += 1;
                    ("Забыто (10+ глав)", ItemUsageState::Forgotten)
                } else if skipped_chapters >= 5 {
                    sleeping_count += 1;
                    ("В ожидании (5+ глав)", ItemUsageState::Sleeping)
                } else {
                    active_count += 1;
                    ("Заряжено", ItemUsageState::Active)
                }
            }
        };

        let current_owner_id = prom.participant_ids.first().cloned();
        let current_owner_name = current_owner_id.as_ref().map(|id| {
            let o_clean = clean_id(id);
            character_names
                .get(o_clean)
                .cloned()
                .unwrap_or_else(|| id.clone())
        });

        let mut custody_chain = Vec::new();
        if let Some(ref ch_id) = prom.chapter_id {
            let clean_cid = clean_id(ch_id);
            let (order, title) = chapter_map
                .get(clean_cid)
                .map(|(o, t)| (Some(*o), Some(t.clone())))
                .unwrap_or((None, None));

            custody_chain.push(CustodyEventDto {
                owner_id: current_owner_id.clone(),
                owner_name: current_owner_name.clone(),
                chapter_id: Some(ch_id.clone()),
                chapter_order: order,
                chapter_title: title,
                m_abs: prom.m_abs,
                circumstances: prom.description.clone().unwrap_or_default(),
                status_on_stage: Some(status_category.to_string()),
            });
        }

        let item_type = if prom.kind.as_deref() == Some("foreshadowing") {
            "Предзнаменование".to_string()
        } else {
            "Чеховское ружьё".to_string()
        };

        tracked_items.push(TrackedItemDto {
            id: prom.id.clone(),
            name: prom.title.clone().unwrap_or_else(|| "Чеховское ружьё".to_string()),
            item_type,
            status_category: status_category.to_string(),
            current_owner_id,
            current_owner_name,
            first_chapter_order: first_ch_order,
            last_chapter_order: last_ch_order,
            skipped_chapters,
            total_mentions: if prom.resolved_at_chapter_id.is_some() { 2 } else { 1 },
            usage_state,
            custody_chain,
        });
    }

    let summary = ItemTrackerSummaryDto {
        total_items: tracked_items.len(),
        active_count,
        sleeping_count,
        forgotten_count,
        destroyed_count,
    };

    Ok(ItemTrackerDto {
        summary,
        items: tracked_items,
    })
}
