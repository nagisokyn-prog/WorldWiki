use super::types::{clean_id, RawItemJourneyBundle};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{ItemJourneyDto, ItemJourneyNodeDto};
use worldwiki_domain::errors::DomainError;

pub(crate) async fn get_item_journey_impl(
    db: &Surreal<Db>,
    project_id: &str,
    item_id: &str,
) -> Result<ItemJourneyDto, DomainError> {
    let proj_clean = project_id.trim_start_matches("projects:");
    let item_clean = clean_id(item_id);

    let sql = "RETURN fn::get_item_journey(type::record('projects', $p), type::record('entities', $e));";

    let mut res = db
        .query(sql)
        .bind(("p", proj_clean.to_string()))
        .bind(("e", item_clean.to_string()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let bundle: Option<RawItemJourneyBundle> =
        crate::surrealdb::repos::helpers::take_one(&mut res, 0)?;
    let bundle = bundle.unwrap_or_default();

    let target_item = bundle
        .item
        .ok_or_else(|| DomainError::Validation(format!("Item {} not found", item_id)))?;

    let characters = bundle.characters;
    let chapters = bundle.chapters;
    let promises = bundle.promises;
    let events = bundle.events;

    let character_names: std::collections::HashMap<String, String> = characters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), c.name))
        .collect();

    let chapter_map: std::collections::HashMap<String, (i32, String)> = chapters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), (c.sort_order.unwrap_or(0), c.title)))
        .collect();

    let attrs = &target_item.attributes;
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

    let mut nodes = Vec::new();

    // 1. Creation node
    let creation_date = attrs
        .get("дата_создания")
        .or_else(|| attrs.get("itemCreationDate"))
        .and_then(|v| v.get("m_abs"))
        .and_then(|v| v.as_i64());
    let origin_loc = attrs
        .get("место_создания")
        .or_else(|| attrs.get("itemOriginLocation"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    nodes.push(ItemJourneyNodeDto {
        id: format!("{}_creation", item_clean),
        title: "Создание / Появление артефакта".to_string(),
        node_type: "creation".to_string(),
        m_abs: creation_date,
        chapter_order: None,
        chapter_id: None,
        chapter_title: None,
        owner_id: None,
        owner_name: if origin_loc.is_empty() {
            None
        } else {
            Some(origin_loc.to_string())
        },
        description: format!(
            "Предмет '{}' ({}) создан / появился в мире",
            target_item.name, item_type
        ),
    });

    // 2. Custody chain nodes
    if let Some(history) = attrs.get("история_владения").and_then(|h| h.as_array()) {
        for (idx, entry) in history.iter().enumerate() {
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
            let m_abs = entry.get("m_abs").and_then(|v| v.as_i64());

            nodes.push(ItemJourneyNodeDto {
                id: format!("{}_custody_{}", item_clean, idx),
                title: format!(
                    "Владелец: {}",
                    if o_name.is_empty() {
                        "Не указан"
                    } else {
                        &o_name
                    }
                ),
                node_type: "custody".to_string(),
                m_abs,
                chapter_order: None,
                chapter_id: None,
                chapter_title: None,
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
                description: circ,
            });
        }
    }

    // 3. Scene and event nodes
    for prom in promises {
        let matches = prom
            .participant_ids
            .iter()
            .any(|p| clean_id(p) == item_clean);
        if matches {
            let (ch_order, ch_title) = prom
                .chapter_id
                .as_ref()
                .and_then(|cid| chapter_map.get(clean_id(cid)))
                .map(|(ord, tit)| (Some(*ord), Some(tit.clone())))
                .unwrap_or((None, None));

            nodes.push(ItemJourneyNodeDto {
                id: format!("promise_{}", clean_id(&prom.id)),
                title: format!("Сцена: {}", prom.title),
                node_type: "scene".to_string(),
                m_abs: prom.m_abs,
                chapter_order: ch_order,
                chapter_id: prom.chapter_id,
                chapter_title: ch_title,
                owner_id: None,
                owner_name: None,
                description: prom.description,
            });
        }
    }

    for ev in events {
        let matches = ev.participants.iter().any(|p| clean_id(p) == item_clean);
        if matches {
            let (ch_order, ch_title) = ev
                .chapter_id
                .as_ref()
                .and_then(|cid| chapter_map.get(clean_id(cid)))
                .map(|(ord, tit)| (Some(*ord), Some(tit.clone())))
                .unwrap_or((None, None));

            nodes.push(ItemJourneyNodeDto {
                id: format!("event_{}", clean_id(&ev.id)),
                title: format!("Событие: {}", ev.title),
                node_type: "scene".to_string(),
                m_abs: ev.m_abs,
                chapter_order: ch_order,
                chapter_id: ev.chapter_id,
                chapter_title: ch_title,
                owner_id: None,
                owner_name: None,
                description: ev.description,
            });
        }
    }

    nodes.sort_by(|a, b| match (a.chapter_order, b.chapter_order) {
        (Some(o1), Some(o2)) if o1 != o2 => o1.cmp(&o2),
        _ => match (a.m_abs, b.m_abs) {
            (Some(m1), Some(m2)) => m1.cmp(&m2),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        },
    });

    Ok(ItemJourneyDto {
        item_id: target_item.id,
        item_name: target_item.name,
        item_type,
        status_category,
        nodes,
    })
}
