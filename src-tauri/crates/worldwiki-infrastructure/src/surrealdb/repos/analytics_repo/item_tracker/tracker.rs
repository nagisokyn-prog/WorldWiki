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
    let proj_clean = project_id.trim_start_matches("projects:");
    let sql = "RETURN fn::get_item_tracker(type::record('projects', $p));";

    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let bundle: Option<RawItemTrackerBundle> =
        crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;
    let bundle = bundle.unwrap_or_default();

    let all_entities = bundle.entities;
    let chapters = bundle.chapters;
    let promises = bundle.promises;
    let events = bundle.events;

    let max_chapter_order = chapters.iter().map(|c| c.sort_order).max().unwrap_or(1);

    // Map chapter id -> (sort_order, title)
    let chapter_map: std::collections::HashMap<String, (i32, String)> = chapters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), (c.sort_order, c.title)))
        .collect();

    let mut character_names = std::collections::HashMap::new();
    let mut item_entities: Vec<RawEntity> = Vec::new();

    for ent in all_entities {
        if ent.entity_type == "character" {
            character_names.insert(clean_id(&ent.id).to_string(), ent.name);
        } else if ent.entity_type == "item" {
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
            if matches {
                if let Some(ref c_id) = prom.chapter_id {
                    let clean_cid = clean_id(c_id);
                    if let Some((order, _)) = chapter_map.get(clean_cid) {
                        appearance_chapter_orders.push(*order);
                    }
                }
            }
        }

        for ev in &events {
            let matches = ev.participants.iter().any(|p| clean_id(p) == item_clean);
            if matches {
                if let Some(ref c_id) = ev.chapter_id {
                    let clean_cid = clean_id(c_id);
                    if let Some((order, _)) = chapter_map.get(clean_cid) {
                        appearance_chapter_orders.push(*order);
                    }
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
            name: item.name,
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
