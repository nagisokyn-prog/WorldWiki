use super::types::{clean_id, RawItemJourneyBundle, RawPromiseRow, RawTimelineEventRow};
use std::collections::HashMap;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{ItemJourneyDto, ItemJourneyNodeDto};
use worldwiki_domain::errors::DomainError;

fn resolve_chapter_info(
    chapter_map: &HashMap<String, (i32, String)>,
    chapter_id: Option<&str>,
) -> (Option<i32>, Option<String>) {
    chapter_id
        .and_then(|cid| chapter_map.get(clean_id(cid)))
        .map(|(ord, tit)| (Some(*ord), Some(tit.clone())))
        .unwrap_or((None, None))
}

fn build_promise_journey(
    item_clean: &str,
    target_item_id: String,
    target_item_name: Option<String>,
    prom: Option<&RawPromiseRow>,
    chapter_map: &HashMap<String, (i32, String)>,
    character_names: &HashMap<String, String>,
) -> ItemJourneyDto {
    let mut nodes = Vec::new();
    let (ch_order, ch_title) = resolve_chapter_info(chapter_map, prom.and_then(|p| p.chapter_id.as_deref()));

    let prom_title = prom
        .and_then(|p| p.title.as_ref())
        .cloned()
        .or(target_item_name)
        .unwrap_or_default();

    let owner_name = prom
        .and_then(|p| p.participant_ids.first())
        .and_then(|pid| character_names.get(clean_id(pid)))
        .cloned();

    let desc = prom
        .and_then(|p| p.description.as_ref())
        .filter(|s| !s.is_empty())
        .cloned()
        .unwrap_or_else(|| prom_title.clone());

    nodes.push(ItemJourneyNodeDto {
        id: format!("{}_plant", item_clean),
        title: "Завязка (Посадка ружья)".to_string(),
        node_type: "creation".to_string(),
        m_abs: prom.and_then(|p| p.m_abs),
        chapter_order: ch_order,
        chapter_id: prom.and_then(|p| p.chapter_id.clone()),
        chapter_title: ch_title,
        owner_id: prom.and_then(|p| p.participant_ids.first().cloned()),
        owner_name,
        description: desc,
    });

    if let Some(res_cid) = prom.and_then(|p| p.resolved_at_chapter_id.as_deref()) {
        let (res_order, res_title) = resolve_chapter_info(chapter_map, Some(res_cid));

        nodes.push(ItemJourneyNodeDto {
            id: format!("{}_resolution", item_clean),
            title: "Выстрел (Развязка ружья)".to_string(),
            node_type: "destruction".to_string(),
            m_abs: None,
            chapter_order: res_order,
            chapter_id: Some(res_cid.to_string()),
            chapter_title: res_title,
            owner_id: None,
            owner_name: None,
            description: "Сюжетное ружьё выстрелило — драматургическая линия завершена.".to_string(),
        });
    }

    let status_category = match prom.and_then(|p| p.status.as_deref()).unwrap_or("Заряжено") {
        "resolved" | "fired" => "Выстрелило".to_string(),
        "broken" | "dropped" => "Сорвано".to_string(),
        _ => "Заряжено".to_string(),
    };

    ItemJourneyDto {
        item_id: target_item_id,
        item_name: prom_title,
        item_type: "Чеховское ружьё".to_string(),
        status_category,
        nodes,
    }
}

fn build_entity_journey(
    item_clean: &str,
    target_item_id: String,
    target_name: Option<String>,
    attrs: &serde_json::Map<String, serde_json::Value>,
    promises: Vec<RawPromiseRow>,
    events: Vec<RawTimelineEventRow>,
    chapter_map: &HashMap<String, (i32, String)>,
    character_names: &HashMap<String, String>,
) -> ItemJourneyDto {
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

    let resolved_name = target_name.as_deref().unwrap_or("");
    nodes.push(ItemJourneyNodeDto {
        id: format!("{}_creation", item_clean),
        title: "Создание / Появление артефакта".to_string(),
        node_type: "creation".to_string(),
        m_abs: creation_date,
        chapter_order: None,
        chapter_id: None,
        chapter_title: None,
        owner_id: None,
        owner_name: if origin_loc.is_empty() { None } else { Some(origin_loc.to_string()) },
        description: format!("Предмет '{}' ({}) создан / появился в мире", resolved_name, item_type),
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

            let display_owner = if o_name.is_empty() { "Не указан" } else { &o_name };
            nodes.push(ItemJourneyNodeDto {
                id: format!("{}_custody_{}", item_clean, idx),
                title: format!("Владелец: {}", display_owner),
                node_type: "custody".to_string(),
                m_abs,
                chapter_order: None,
                chapter_id: None,
                chapter_title: None,
                owner_id: if owner_val.is_empty() { None } else { Some(owner_val.to_string()) },
                owner_name: if o_name.is_empty() { None } else { Some(o_name) },
                description: circ,
            });
        }
    }

    // 3. Scene and event nodes
    for prom in promises {
        if prom.participant_ids.iter().any(|p| clean_id(p) == item_clean) {
            let (ch_order, ch_title) = resolve_chapter_info(chapter_map, prom.chapter_id.as_deref());
            let title = format!("Сцена: {}", prom.title.as_deref().unwrap_or(""));

            nodes.push(ItemJourneyNodeDto {
                id: format!("promise_{}", clean_id(&prom.id)),
                title,
                node_type: "scene".to_string(),
                m_abs: prom.m_abs,
                chapter_order: ch_order,
                chapter_id: prom.chapter_id,
                chapter_title: ch_title,
                owner_id: None,
                owner_name: None,
                description: prom.description.unwrap_or_default(),
            });
        }
    }

    for ev in events {
        if ev.participants.iter().any(|p| clean_id(p) == item_clean) {
            let (ch_order, ch_title) = resolve_chapter_info(chapter_map, ev.chapter_id.as_deref());
            let title = format!("Событие: {}", ev.title.as_deref().unwrap_or(""));

            nodes.push(ItemJourneyNodeDto {
                id: format!("event_{}", clean_id(&ev.id)),
                title,
                node_type: "scene".to_string(),
                m_abs: ev.m_abs,
                chapter_order: ch_order,
                chapter_id: ev.chapter_id,
                chapter_title: ch_title,
                owner_id: None,
                owner_name: None,
                description: ev.description.unwrap_or_default(),
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

    ItemJourneyDto {
        item_id: target_item_id,
        item_name: target_name.unwrap_or_default(),
        item_type,
        status_category,
        nodes,
    }
}

pub(crate) async fn get_item_journey_impl(
    db: &Surreal<Db>,
    project_id: &str,
    item_id: &str,
) -> Result<ItemJourneyDto, DomainError> {
    let proj_clean = clean_raw_id!(project_id, "projects");
    let item_clean = clean_id(item_id);

    let is_promise = item_id.starts_with("plot_promises");
    let sql = if is_promise {
        "RETURN fn::get_item_journey(type::record('projects', $p), type::record('plot_promises', $e));"
    } else {
        "RETURN fn::get_item_journey(type::record('projects', $p), type::record('entities', $e));"
    };

    let bundle: Option<RawItemJourneyBundle> = surreal_take_one!(
        db,
        sql,
        ("p", proj_clean),
        ("e", item_clean.to_string()),
    )?;
    let bundle = bundle.unwrap_or_default();

    let target_item = bundle
        .item
        .ok_or_else(|| DomainError::Validation(format!("Item {} not found", item_id)))?;

    let character_names: HashMap<String, String> = bundle
        .characters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), c.name.unwrap_or_default()))
        .collect();

    let chapter_map: HashMap<String, (i32, String)> = bundle
        .chapters
        .into_iter()
        .map(|c| (clean_id(&c.id).to_string(), (c.sort_order.unwrap_or(0), c.title.unwrap_or_default())))
        .collect();

    if is_promise {
        let prom = bundle.promises.iter().find(|p| clean_id(&p.id) == item_clean);
        return Ok(build_promise_journey(
            item_clean,
            target_item.id,
            target_item.name,
            prom,
            &chapter_map,
            &character_names,
        ));
    }

    Ok(build_entity_journey(
        item_clean,
        target_item.id,
        target_item.name,
        &target_item.attributes,
        bundle.promises,
        bundle.events,
        &chapter_map,
        &character_names,
    ))
}
