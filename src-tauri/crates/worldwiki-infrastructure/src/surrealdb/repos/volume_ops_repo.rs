use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoExtendResult {
    pub chapter_id: String,
    pub volume_id: Option<String>,
    pub updated_count: u64,
}

fn make_record(table: &str, full_id: &str) -> RecordId {
    let raw = full_id
        .split(':')
        .nth(1)
        .unwrap_or(full_id)
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim_matches('`');
    RecordId::new(table, raw)
}

fn compare_record_ids(id1: &str, id2: &str) -> bool {
    let clean1 = id1.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    let clean2 = id2.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    if clean1 == clean2 {
        return true;
    }
    let raw1 = clean1.split(':').next_back().unwrap_or(clean1);
    let raw2 = clean2.split(':').next_back().unwrap_or(clean2);
    raw1 == raw2
}

pub fn update_point_if_auto_extend(
    val: &mut serde_json::Value,
    new_point: &serde_json::Value,
) -> bool {
    let mut modified = false;
    match val {
        serde_json::Value::Object(map) => {
            if let Some(auto_val) = map.get("is_auto_extend")
                && auto_val.as_bool() == Some(true)
            {
                if let Some(ch) = new_point.get("chapter_id") {
                    map.insert("chapter_id".to_string(), ch.clone());
                }
                if let Some(vol) = new_point.get("volume_id") {
                    map.insert("volume_id".to_string(), vol.clone());
                }
                return true;
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

pub fn heal_point_if_matches_chapter(
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

pub async fn create_volume(
    db: &Surreal<Db>,
    project: &str,
    title: &str,
) -> Result<serde_json::Value, DomainError> {
    let clean_pid = project.trim().replace("projects:", "");

    let mut max_order_res = db
        .query("RETURN fn::get_max_volume_sort_order(type::record('projects', $p));")
        .bind(("p", clean_pid.clone()))
        .await
        .map_err(DomainError::constraint_violation)?;
    let max_order: i64 = max_order_res
        .take::<Option<i64>>(0)
        .map_err(DomainError::constraint_violation)?
        .unwrap_or(-1);
    let next_order = max_order + 1;

    let query = "RETURN fn::create_volume_node(type::record('projects', $p), $title, $order);";
    let mut create_res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("title", title.to_string()))
        .bind(("order", next_order))
        .await
        .map_err(DomainError::constraint_violation)?;

    let vol: Option<serde_json::Value> = create_res
        .take(0)
        .map_err(DomainError::constraint_violation)?;
    Ok(serde_json::json!(vol))
}

pub async fn update_volume(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), DomainError> {
    let clean_id = id.trim_start_matches("volumes:").to_string();
    db.query("fn::update_volume_title(type::record('volumes', $id), $title);")
        .bind(("id", clean_id))
        .bind(("title", title.to_string()))
        .await
        .map_err(DomainError::constraint_violation)?;
    Ok(())
}

pub async fn reorder_node(
    db: &Surreal<Db>,
    _project: &str,
    node_type: &str,
    id: &str,
    sort_order: i64,
) -> Result<(), DomainError> {
    let table = if node_type == "volume" || node_type == "volumes" {
        "volumes"
    } else {
        "chapters"
    };
    let raw_id = id.split_once(':').map(|(_, b)| b).unwrap_or(id).to_string();

    db.query("fn::reorder_node(type::record($table, $id), $order);")
        .bind(("table", table.to_string()))
        .bind(("id", raw_id))
        .bind(("order", sort_order))
        .await
        .map_err(DomainError::constraint_violation)?;

    Ok(())
}

pub async fn get_chapter_hierarchy(
    db: &Surreal<Db>,
    project: &str,
) -> Result<serde_json::Value, DomainError> {
    let pid_raw = project.trim().replace("projects:", "");
    let query = "RETURN fn::get_chapter_hierarchy(fn::normalize_project_id($p));";

    let mut res = db
        .query(query)
        .bind(("p", pid_raw))
        .await
        .map_err(DomainError::constraint_violation)?;

    let raw: Option<serde_json::Value> = res.take(0).map_err(DomainError::constraint_violation)?;
    let mut volumes: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("volumes"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut chapters: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("chapters"))
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
    let edges: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("relations"))
        .and_then(|e| e.as_array())
        .cloned()
        .unwrap_or_default();

    for vol in &mut volumes {
        if let Some(id) = vol.get("id").and_then(|i| i.as_str())
            && let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id))
            && let Some(so) = edge.get("sort_order")
            && let Some(obj) = vol.as_object_mut()
        {
            obj.insert("sort_order".to_string(), so.clone());
        }
    }

    for chap in &mut chapters {
        if let Some(id) = chap.get("id").and_then(|i| i.as_str()) {
            let mut matched_edge: Option<&serde_json::Value> = None;
            for e in &edges {
                if let Some(out) = e.get("out").and_then(|o| o.as_str())
                    && compare_record_ids(out, id)
                {
                    matched_edge = Some(e);
                    break;
                }
            }
            if let Some(edge) = matched_edge
                && let Some(obj) = chap.as_object_mut()
            {
                if let Some(parent) = edge.get("in").and_then(|i| i.as_str())
                    && parent.starts_with("volumes:")
                {
                    obj.insert(
                        "volume_id".to_string(),
                        serde_json::Value::String(parent.to_string()),
                    );
                }
                if let Some(so) = edge.get("sort_order") {
                    obj.insert("sort_order".to_string(), so.clone());
                }
            }
        }
    }

    volumes.sort_by_key(|v| v.get("sort_order").and_then(|s| s.as_i64()).unwrap_or(0));
    chapters.sort_by_key(|a| a.get("sort_order").and_then(|s| s.as_i64()).unwrap_or(0));

    Ok(serde_json::json!({
        "volumes": volumes,
        "chapters": chapters
    }))
}

pub async fn auto_extend_entities(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    volume_id: Option<String>,
) -> Result<u64, DomainError> {
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
        .await
        .map_err(DomainError::constraint_violation)?;

    let mut entities: Vec<serde_json::Value> =
        res.take(0).map_err(DomainError::constraint_violation)?;
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity
            .get("id")
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        if let Some(id_str) = id_opt
            && let Some(attr) = entity.get_mut("attributes")
            && update_point_if_auto_extend(attr, &new_point)
        {
            let clean_id = id_str.trim_start_matches("entities:").to_string();
            let _ = db
                .query("fn::update_entity_attributes(type::record('entities', $id), $attr);")
                .bind(("id", clean_id))
                .bind(("attr", attr.clone()))
                .await;
            updated_count += 1;
        }
    }

    Ok(updated_count)
}

pub async fn heal_deleted_chapter(
    db: &Surreal<Db>,
    project: &str,
    deleted_chapter_id: &str,
    fallback_point: Option<AutoExtendResult>,
) -> Result<u64, DomainError> {
    let clean_pid = project.trim().replace("projects:", "");

    let mut res = db
        .query("RETURN fn::get_entities_attributes(type::record('projects', $p));")
        .bind(("p", clean_pid))
        .await
        .map_err(DomainError::constraint_violation)?;

    let mut entities: Vec<serde_json::Value> =
        res.take(0).map_err(DomainError::constraint_violation)?;
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity
            .get("id")
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        if let Some(id_str) = id_opt
            && let Some(attr) = entity.get_mut("attributes")
            && heal_point_if_matches_chapter(attr, deleted_chapter_id, fallback_point.as_ref())
        {
            let clean_id = id_str.trim_start_matches("entities:").to_string();
            let _ = db
                .query("fn::update_entity_attributes(type::record('entities', $id), $attr);")
                .bind(("id", clean_id))
                .bind(("attr", attr.clone()))
                .await;
            updated_count += 1;
        }
    }

    Ok(updated_count)
}

pub async fn assign_chapter(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    volume_id: Option<String>,
) -> Result<AutoExtendResult, DomainError> {
    let pid_raw = project.trim().replace("projects:", "");
    let clean_chap = if chapter_id.contains(':') {
        chapter_id.to_string()
    } else {
        format!("chapters:{}", chapter_id)
    };

    let new_parent: RecordId = if let Some(ref v) = volume_id {
        make_record("volumes", v)
    } else {
        RecordId::new("projects", pid_raw.as_str())
    };
    let chap_rec = make_record("chapters", &clean_chap);

    let mut res = db
        .query("fn::assign_chapter_node($parent, $chap);")
        .bind(("chap", chap_rec))
        .bind(("parent", new_parent))
        .await
        .map_err(DomainError::constraint_violation)?;

    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(DomainError::ConstraintViolation(format!(
            "assign_chapter error: {}",
            e
        )));
    }

    let updated_count =
        auto_extend_entities(db, project, &clean_chap, volume_id.clone()).await?;

    Ok(AutoExtendResult {
        chapter_id: clean_chap,
        volume_id,
        updated_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_record_ids_handles_table_prefix_and_brackets() {
        assert!(compare_record_ids("chapters:c1", "⟨chapters:c1⟩"));
        assert!(compare_record_ids("c1", "chapters:c1"));
        assert!(!compare_record_ids("chapters:c1", "chapters:c2"));
    }

    #[test]
    fn update_point_if_auto_extend_updates_nested_points() {
        let mut attrs = serde_json::json!({
            "timeline": [
                { "is_auto_extend": true, "chapter_id": "chapters:c1", "volume_id": null },
                { "is_auto_extend": false, "chapter_id": "chapters:c1" }
            ]
        });
        let new_pt = serde_json::json!({ "chapter_id": "chapters:c2", "volume_id": "volumes:v1" });
        assert!(update_point_if_auto_extend(&mut attrs, &new_pt));
        assert_eq!(attrs["timeline"][0]["chapter_id"], "chapters:c2");
        assert_eq!(attrs["timeline"][0]["volume_id"], "volumes:v1");
        assert_eq!(attrs["timeline"][1]["chapter_id"], "chapters:c1");
    }

    #[test]
    fn heal_point_if_matches_chapter_uses_fallback_or_null() {
        let mut attrs = serde_json::json!({
            "pt": { "chapter_id": "chapters:c_del", "volume_id": "volumes:v1" }
        });
        let fb = AutoExtendResult {
            chapter_id: "chapters:c_prev".to_string(),
            volume_id: Some("volumes:v0".to_string()),
            updated_count: 0,
        };
        assert!(heal_point_if_matches_chapter(&mut attrs, "c_del", Some(&fb)));
        assert_eq!(attrs["pt"]["chapter_id"], "chapters:c_prev");

        assert!(heal_point_if_matches_chapter(&mut attrs, "chapters:c_prev", None));
        assert!(attrs["pt"]["chapter_id"].is_null());
    }
}
