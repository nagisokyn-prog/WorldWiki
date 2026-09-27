use crate::logic::volumes::errors::VolumeError;
use crate::logic::volumes::lifecycle::AutoExtendResult;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

fn update_point_if_auto_extend(
    val: &mut serde_json::Value,
    new_point: &serde_json::Value,
) -> bool {
    let mut modified = false;
    match val {
        serde_json::Value::Object(map) => {
            if let Some(auto_val) = map.get("is_auto_extend") {
                if auto_val.as_bool() == Some(true) {
                    if let Some(ch) = new_point.get("chapter_id") {
                        map.insert("chapter_id".to_string(), ch.clone());
                    }
                    if let Some(vol) = new_point.get("volume_id") {
                        map.insert("volume_id".to_string(), vol.clone());
                    }
                    return true;
                }
            }
            for (_k, v) in map.iter_mut() {
                if update_point_if_auto_extend(v, new_point) {
                    modified = true;
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                if update_point_if_auto_extend(item, new_point) {
                    modified = true;
                }
            }
        }
        _ => {}
    }
    modified
}

pub async fn auto_extend_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    volume_id: Option<String>,
) -> Result<u64, VolumeError> {
    let clean_pid = project.trim().replace("projects:", "");

    let clean_chap = if chapter_id.contains(':') {
        chapter_id.to_string()
    } else {
        format!("chapters:{}", chapter_id)
    };

    let new_point = serde_json::json!({
        "chapter_id": clean_chap,
        "volume_id": volume_id,
        "is_auto_extend": true
    });

    let mut res = db
        .query("RETURN fn::get_entities_attributes(type::record('projects', $p));")
        .bind(("p", clean_pid))
        .await?;

    let mut entities: Vec<serde_json::Value> = res.take(0).unwrap_or_default();
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity
            .get("id")
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        if let Some(id_str) = id_opt {
            if let Some(attr) = entity.get_mut("attributes") {
                if update_point_if_auto_extend(attr, &new_point) {
                    let clean_id = id_str.trim_start_matches("entities:").to_string();
                    let _ = db
                        .query("fn::update_entity_attributes(type::record('entities', $id), $attr);")
                        .bind(("id", clean_id))
                        .bind(("attr", attr.clone()))
                        .await;
                    updated_count += 1;
                }
            }
        }
    }

    Ok(updated_count)
}

fn heal_point_if_matches_chapter(
    val: &mut serde_json::Value,
    deleted_chap: &str,
    fallback_point: Option<&AutoExtendResult>,
) -> bool {
    let mut modified = false;
    let del_clean = deleted_chap.trim_matches('⟨').trim_matches('⟩');
    let del_raw = del_clean.split(':').next_back().unwrap_or(del_clean);

    match val {
        serde_json::Value::Object(map) => {
            if let Some(ch_val) = map.get("chapter_id").and_then(|v| v.as_str()) {
                let ch_clean = ch_val.trim_matches('⟨').trim_matches('⟩');
                let ch_raw = ch_clean.split(':').next_back().unwrap_or(ch_clean);
                if ch_clean == del_clean || ch_raw == del_raw {
                    if let Some(fb) = fallback_point {
                        map.insert("chapter_id".to_string(), serde_json::json!(fb.chapter_id));
                        map.insert("volume_id".to_string(), serde_json::json!(fb.volume_id));
                    } else {
                        map.insert("chapter_id".to_string(), serde_json::Value::Null);
                        map.insert("volume_id".to_string(), serde_json::Value::Null);
                    }
                    return true;
                }
            }
            for (_k, v) in map.iter_mut() {
                if heal_point_if_matches_chapter(v, deleted_chap, fallback_point) {
                    modified = true;
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                if heal_point_if_matches_chapter(item, deleted_chap, fallback_point) {
                    modified = true;
                }
            }
        }
        _ => {}
    }
    modified
}

pub async fn heal_deleted_chapter_inner(
    db: &Surreal<Db>,
    project: &str,
    deleted_chapter_id: &str,
    fallback_point: Option<AutoExtendResult>,
) -> Result<u64, VolumeError> {
    let clean_pid = project.trim().replace("projects:", "");

    let mut res = db
        .query("RETURN fn::get_entities_attributes(type::record('projects', $p));")
        .bind(("p", clean_pid))
        .await?;

    let mut entities: Vec<serde_json::Value> = res.take(0).unwrap_or_default();
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity
            .get("id")
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        if let Some(id_str) = id_opt {
            if let Some(attr) = entity.get_mut("attributes") {
                if heal_point_if_matches_chapter(
                    attr,
                    deleted_chapter_id,
                    fallback_point.as_ref(),
                ) {
                    let clean_id = id_str.trim_start_matches("entities:").to_string();
                    let _ = db
                        .query("fn::update_entity_attributes(type::record('entities', $id), $attr);")
                        .bind(("id", clean_id))
                        .bind(("attr", attr.clone()))
                        .await;
                    updated_count += 1;
                }
            }
        }
    }

    Ok(updated_count)
}
