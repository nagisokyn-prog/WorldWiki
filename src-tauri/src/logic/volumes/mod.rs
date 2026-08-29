use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

// IPC layer extracted (architecture split):
mod commands;
pub use commands::*;


pub async fn get_chapter_hierarchy_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<serde_json::Value, String> {
    println!("🔥🔥🔥 [BACKEND] get_chapter_hierarchy CALLED! project='{}'", project);
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    let pid_val = format!("projects:{}", pid_raw);
    let pid_literal = format!("projects:`{}`", pid_raw);

    let query_cond = "project_id = $proj OR project_id = $pid_val OR project_id = $pid_literal";

    // Загружаем тома
    let mut volumes_res = db.query(format!("SELECT * FROM volumes WHERE {}", query_cond))
        .bind(("proj", proj_rec.clone()))
        .bind(("pid_val", pid_val.clone()))
        .bind(("pid_literal", pid_literal.clone()))
        .await.map_err(|e| e.to_string())?;
    let mut volumes: Vec<serde_json::Value> = volumes_res.take(0).unwrap_or_default();
    println!("🔥🔥🔥 [BACKEND] get_chapter_hierarchy: found {} volumes", volumes.len());

    // Загружаем арки
    let mut arcs_res = db.query(format!("SELECT * FROM arcs WHERE {}", query_cond))
        .bind(("proj", proj_rec.clone()))
        .bind(("pid_val", pid_val.clone()))
        .bind(("pid_literal", pid_literal.clone()))
        .await.map_err(|e| e.to_string())?;
    let mut arcs: Vec<serde_json::Value> = arcs_res.take(0).unwrap_or_default();
    println!("🔥🔥🔥 [BACKEND] get_chapter_hierarchy: found {} arcs", arcs.len());

    // Загружаем главы
    let mut chapters_res = db.query(format!("SELECT * FROM chapters WHERE {}", query_cond))
        .bind(("proj", proj_rec.clone()))
        .bind(("pid_val", pid_val.clone()))
        .bind(("pid_literal", pid_literal.clone()))
        .await.map_err(|e| e.to_string())?;
    let mut chapters: Vec<serde_json::Value> = chapters_res.take(0).unwrap_or_default();
    println!("🔥🔥🔥 [BACKEND] get_chapter_hierarchy: found {} chapters", chapters.len());

    // Загружаем все ребра contains, которые указывают на наши тома, арки или главы
    let mut edges_res = db.query(format!(r#"
        SELECT in, out, sort_order FROM contains 
        WHERE out IN (SELECT VALUE id FROM volumes WHERE {cond})
           OR out IN (SELECT VALUE id FROM arcs WHERE {cond})
           OR out IN (SELECT VALUE id FROM chapters WHERE {cond})
    "#, cond = query_cond))
        .bind(("proj", proj_rec.clone()))
        .bind(("pid_val", pid_val.clone()))
        .bind(("pid_literal", pid_literal.clone()))
        .await.map_err(|e| e.to_string())?;
    let edges: Vec<serde_json::Value> = edges_res.take(0).unwrap_or_default();
    println!("🔥🔥🔥 [BACKEND] get_chapter_hierarchy: found {} edges", edges.len());

    // Маппинг связей в Rust
    for vol in &mut volumes {
        if let Some(id) = vol.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id)) {
                vol["sort_order"] = edge["sort_order"].clone();
            }
        }
    }

    fn compare_record_ids(id1: &str, id2: &str) -> bool {
        let clean1 = id1.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
        let clean2 = id2.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
        if clean1 == clean2 {
            return true;
        }
        let raw1 = clean1.split(':').last().unwrap_or(clean1);
        let raw2 = clean2.split(':').last().unwrap_or(clean2);
        raw1 == raw2
    }

    for arc in &mut arcs {
        if let Some(id) = arc.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| {
                e.get("out").and_then(|o| o.as_str()).map(|o| compare_record_ids(o, id)).unwrap_or(false)
            }) {
                if let Some(parent) = edge.get("in").and_then(|i| i.as_str()) {
                    if parent.starts_with("volumes:") {
                        arc["volume_id"] = edge["in"].clone();
                    }
                }
                arc["sort_order"] = edge["sort_order"].clone();
            }
        }
    }

    for chap in &mut chapters {
        if let Some(id) = chap.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| {
                e.get("out").and_then(|o| o.as_str()).map(|o| compare_record_ids(o, id)).unwrap_or(false)
            }) {
                if let Some(parent) = edge.get("in").and_then(|i| i.as_str()) {
                    if parent.starts_with("arcs:") {
                        chap["arc_id"] = edge["in"].clone();
                    } else if parent.starts_with("volumes:") {
                        chap["volume_id"] = edge["in"].clone();
                    }
                }
                chap["sort_order"] = edge["sort_order"].clone();
            }
        }
    }

    volumes.sort_by_key(|v| v["sort_order"].as_i64().unwrap_or(0));
    arcs.sort_by_key(|a| a["sort_order"].as_i64().unwrap_or(0));
    chapters.sort_by_key(|a| a["sort_order"].as_i64().unwrap_or(0));

    Ok(serde_json::json!({
        "volumes": volumes,
        "arcs": arcs,
        "chapters": chapters
    }))
}


pub async fn create_volume_inner(
    db: &Surreal<Db>,
    project: &str,
    title: &str,
) -> Result<serde_json::Value, String> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    
    // Получаем следующий sort_order
    let mut max_order_res = db.query(r#"
        SELECT math::max(sort_order) AS max_order FROM contains WHERE in = $proj GROUP ALL
    "#).bind(("proj", proj_rec.clone())).await.map_err(|e| e.to_string())?;
    let max_orders: Vec<serde_json::Value> = max_order_res.take(0).unwrap_or_default();
    let next_order = max_orders.first()
        .and_then(|v| v.get("max_order"))
        .and_then(|n| n.as_i64())
        .unwrap_or(-1) + 1;

    let mut create_res = db.query(r#"
        LET $vol = (CREATE volumes SET project_id = $proj, title = $title RETURN VALUE id)[0];
        RELATE $proj -> contains -> $vol SET sort_order = $order;
        SELECT id, title, project_id, $order AS sort_order FROM $vol;
    "#).bind(("proj", proj_rec.clone())).bind(("title", title.to_string())).bind(("order", next_order)).await.map_err(|e| e.to_string())?;
    
    let vols: Vec<serde_json::Value> = create_res.take(2).unwrap_or_default();
    Ok(serde_json::json!(vols.first()))
}


pub async fn update_volume_inner(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), String> {
    let clean_id = if id.contains(':') { id.to_string() } else { format!("volumes:{}", id) };
    db.query("UPDATE type::record($id) SET title = $title")
        .bind(("id", clean_id))
        .bind(("title", title.to_string()))
        .await.map_err(|e| e.to_string())?;
    Ok(())
}


pub async fn create_arc_inner(
    db: &Surreal<Db>,
    project: &str,
    title: &str,
    volume_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    let parent_str = volume_id.unwrap_or_else(|| format!("projects:{}", pid_raw));
    let clean_vol_id = if parent_str.contains(':') { parent_str } else { format!("volumes:{}", parent_str) };
    
    let mut max_order_res = db.query(r#"
        SELECT math::max(sort_order) AS max_order FROM contains WHERE in = type::record($parent) GROUP ALL
    "#).bind(("parent", clean_vol_id.clone())).await.map_err(|e| e.to_string())?;
    let max_orders: Vec<serde_json::Value> = max_order_res.take(0).unwrap_or_default();
    let next_order = max_orders.first()
        .and_then(|v| v.get("max_order"))
        .and_then(|n| n.as_i64())
        .unwrap_or(-1) + 1;

    let mut create_res = db.query(r#"
        LET $arc = (CREATE arcs SET project_id = $proj, title = $title RETURN VALUE id)[0];
        LET $parent_rec = type::record($parent);
        RELATE $parent_rec -> contains -> $arc SET sort_order = $order;
        SELECT id, title, project_id, type::record($parent) AS volume_id, $order AS sort_order FROM $arc;
    "#)
    .bind(("proj", proj_rec.clone()))
    .bind(("parent", clean_vol_id.clone()))
    .bind(("title", title.to_string()))
    .bind(("order", next_order))
    .await.map_err(|e| e.to_string())?;
    
    let arcs: Vec<serde_json::Value> = create_res.take(3).unwrap_or_default();
    Ok(serde_json::json!(arcs.first()))
}


pub async fn update_arc_inner(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), String> {
    let clean_id = if id.contains(':') { id.to_string() } else { format!("arcs:{}", id) };
    db.query("UPDATE type::record($id) SET title = $title")
        .bind(("id", clean_id))
        .bind(("title", title.to_string()))
        .await.map_err(|e| e.to_string())?;
    Ok(())
}


#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoExtendResult {
    pub chapter_id: String,
    pub arc_id: Option<String>,
    pub volume_id: Option<String>,
    pub updated_count: u64,
}

pub async fn assign_chapter_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    arc_id: Option<String>,
    volume_id: Option<String>,
) -> Result<AutoExtendResult, String> {
    println!("\n\n🔥🔥🔥 [BACKEND] assign_chapter CALLED! project='{}', chapter_id='{}', arc_id={:?}, volume_id={:?}", project, chapter_id, arc_id, volume_id);
    let pid_raw = project.trim().replace("projects:", "");
    let clean_chap = if chapter_id.contains(':') { chapter_id.to_string() } else { format!("chapters:{}", chapter_id) };

    fn make_record(table: &str, full_id: &str) -> RecordId {
        let raw = full_id.split(':').nth(1).unwrap_or(full_id).trim_matches('⟨').trim_matches('⟩').trim_matches('`');
        RecordId::new(table, raw)
    }

    let new_parent: RecordId = if let Some(ref a) = arc_id {
        make_record("arcs", a)
    } else if let Some(ref v) = volume_id {
        make_record("volumes", v)
    } else {
        RecordId::new("projects", pid_raw.as_str())
    };

    let chap_raw = clean_chap.split(':').nth(1).unwrap_or(&clean_chap).trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    let chap_rec = RecordId::new("chapters", chap_raw);

    let mut res = db.query(r#"
        DELETE contains WHERE out = $chap;
        RELATE $parent -> contains -> $chap SET sort_order = 9999;
    "#)
    .bind(("chap", chap_rec))
    .bind(("parent", new_parent))
    .await.map_err(|e| e.to_string())?;

    let errs = res.take_errors();
    if !errs.is_empty() {
        let e = errs.values().next().unwrap();
        eprintln!("[ERROR] assign_chapter error: {}", e);
        return Err(e.to_string());
    }

    // Автопродление: если глава привязана, обновляем все точки с is_auto_extend = true в базе
    let updated_count = auto_extend_entities_inner(db, project, &clean_chap, arc_id.clone(), volume_id.clone()).await?;

    Ok(AutoExtendResult {
        chapter_id: clean_chap,
        arc_id,
        volume_id,
        updated_count,
    })
}

fn update_point_if_auto_extend(val: &mut serde_json::Value, new_point: &serde_json::Value) -> bool {
    let mut modified = false;
    match val {
        serde_json::Value::Object(map) => {
            if let Some(auto_val) = map.get("is_auto_extend") {
                if auto_val.as_bool() == Some(true) {
                    if let Some(ch) = new_point.get("chapter_id") {
                        map.insert("chapter_id".to_string(), ch.clone());
                    }
                    if let Some(arc) = new_point.get("arc_id") {
                        map.insert("arc_id".to_string(), arc.clone());
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
    arc_id: Option<String>,
    volume_id: Option<String>,
) -> Result<u64, String> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    let pid_val = format!("projects:{}", pid_raw);
    let pid_literal = format!("projects:`{}`", pid_raw);

    let clean_chap = if chapter_id.contains(':') { chapter_id.to_string() } else { format!("chapters:{}", chapter_id) };

    let new_point = serde_json::json!({
        "chapter_id": clean_chap,
        "arc_id": arc_id,
        "volume_id": volume_id,
        "is_auto_extend": true
    });

    let query_cond = "project_id = $proj OR project_id = $pid_val OR project_id = $pid_literal";
    let mut res = db.query(format!("SELECT id, attributes FROM entities WHERE {}", query_cond))
        .bind(("proj", proj_rec))
        .bind(("pid_val", pid_val))
        .bind(("pid_literal", pid_literal))
        .await
        .map_err(|e| e.to_string())?;

    let mut entities: Vec<serde_json::Value> = res.take(0).unwrap_or_default();
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
        if let Some(id_str) = id_opt {
            if let Some(attr) = entity.get_mut("attributes") {
                if update_point_if_auto_extend(attr, &new_point) {
                    let clean_id = if id_str.contains(':') { id_str } else { format!("entities:{}", id_str) };
                    let _ = db.query("UPDATE type::record($id) SET attributes = $attr")
                        .bind(("id", clean_id))
                        .bind(("attr", attr.clone()))
                        .await;
                    updated_count += 1;
                }
            }
        }
    }

    println!("🔥🔥🔥 [BACKEND] auto_extend_entities: updated {} entities with new chapter '{}'", updated_count, chapter_id);
    Ok(updated_count)
}

fn heal_point_if_matches_chapter(
    val: &mut serde_json::Value,
    deleted_chap: &str,
    fallback_point: Option<&AutoExtendResult>,
) -> bool {
    let mut modified = false;
    let del_clean = deleted_chap.trim_matches('⟨').trim_matches('⟩');
    let del_raw = del_clean.split(':').last().unwrap_or(del_clean);

    match val {
        serde_json::Value::Object(map) => {
            if let Some(ch_val) = map.get("chapter_id").and_then(|v| v.as_str()) {
                let ch_clean = ch_val.trim_matches('⟨').trim_matches('⟩');
                let ch_raw = ch_clean.split(':').last().unwrap_or(ch_clean);
                if ch_clean == del_clean || ch_raw == del_raw {
                    if let Some(fb) = fallback_point {
                        map.insert("chapter_id".to_string(), serde_json::json!(fb.chapter_id));
                        map.insert("arc_id".to_string(), serde_json::json!(fb.arc_id));
                        map.insert("volume_id".to_string(), serde_json::json!(fb.volume_id));
                    } else {
                        map.insert("chapter_id".to_string(), serde_json::Value::Null);
                        map.insert("arc_id".to_string(), serde_json::Value::Null);
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
) -> Result<u64, String> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    let pid_val = format!("projects:{}", pid_raw);
    let pid_literal = format!("projects:`{}`", pid_raw);

    let query_cond = "project_id = $proj OR project_id = $pid_val OR project_id = $pid_literal";
    let mut res = db.query(format!("SELECT id, attributes FROM entities WHERE {}", query_cond))
        .bind(("proj", proj_rec))
        .bind(("pid_val", pid_val))
        .bind(("pid_literal", pid_literal))
        .await
        .map_err(|e| e.to_string())?;

    let mut entities: Vec<serde_json::Value> = res.take(0).unwrap_or_default();
    let mut updated_count: u64 = 0;

    for entity in &mut entities {
        let id_opt = entity.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
        if let Some(id_str) = id_opt {
            if let Some(attr) = entity.get_mut("attributes") {
                if heal_point_if_matches_chapter(attr, deleted_chapter_id, fallback_point.as_ref()) {
                    let clean_id = if id_str.contains(':') { id_str } else { format!("entities:{}", id_str) };
                    let _ = db.query("UPDATE type::record($id) SET attributes = $attr")
                        .bind(("id", clean_id))
                        .bind(("attr", attr.clone()))
                        .await;
                    updated_count += 1;
                }
            }
        }
    }

    println!("🔥🔥🔥 [BACKEND] heal_deleted_chapter: updated {} entities from deleted '{}' to fallback {:?}", updated_count, deleted_chapter_id, fallback_point);
    Ok(updated_count)
}


pub async fn reorder_node_inner(
    db: &Surreal<Db>,
    _project: &str,
    node_type: &str,
    id: &str,
    sort_order: i64,
) -> Result<(), String> {
    let clean_id = if id.contains(':') { id.to_string() } else { format!("{}s:{}", node_type, id) };
    
    // Обновляем sort_order на входящем ребре contains
    db.query("UPDATE contains SET sort_order = $order WHERE out = type::record($id)")
        .bind(("id", clean_id))
        .bind(("order", sort_order))
        .await.map_err(|e| e.to_string())?;
        
    Ok(())
}

