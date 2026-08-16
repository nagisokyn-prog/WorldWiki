use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    get_chapter_hierarchy_inner(&state.db, &project).await
}

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

    for arc in &mut arcs {
        if let Some(id) = arc.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id)) {
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
            if let Some(edge) = edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id)) {
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

#[tauri::command]
pub async fn create_volume(
    project: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    create_volume_inner(&state.db, &project, &title).await
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

#[tauri::command]
pub async fn update_volume(
    _project: String,
    id: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    update_volume_inner(&state.db, &id, &title).await
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

#[tauri::command]
pub async fn create_arc(
    project: String,
    title: String,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    create_arc_inner(&state.db, &project, &title, volume_id).await
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

#[tauri::command]
pub async fn update_arc(
    _project: String,
    id: String,
    title: String,
    _volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    update_arc_inner(&state.db, &id, &title).await
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

#[tauri::command]
pub async fn assign_chapter(
    project: String,
    chapter_id: String,
    arc_id: Option<String>,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    assign_chapter_inner(&state.db, &project, &chapter_id, arc_id, volume_id).await
}

pub async fn assign_chapter_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    arc_id: Option<String>,
    volume_id: Option<String>,
) -> Result<(), String> {
    println!("\n\n🔥🔥🔥 [BACKEND] assign_chapter CALLED! project='{}', chapter_id='{}', arc_id={:?}, volume_id={:?}", project, chapter_id, arc_id, volume_id);
    let clean_chap = if chapter_id.contains(':') { chapter_id.to_string() } else { format!("chapters:{}", chapter_id) };
    let pid_raw = project.trim().replace("projects:", "");
    
    // Определяем нового родителя: arc_id > volume_id > project_id — нативный RecordId
    fn make_record(table: &str, full_id: &str) -> RecordId {
        let raw = full_id.split(':').nth(1).unwrap_or(full_id);
        RecordId::new(table, raw)
    }
    let new_parent = if let Some(ref a) = arc_id {
        make_record("arcs", a)
    } else if let Some(ref v) = volume_id {
        make_record("volumes", v)
    } else {
        RecordId::new("projects", pid_raw.as_str())
    };

    println!("🔥🔥🔥 [BACKEND] assign_chapter: new_parent = {:?}", new_parent);

    // Удаляем старые связи и создаем новую
    let chap_raw = clean_chap.split(':').nth(1).unwrap_or(&clean_chap).to_string();
    let chap_rec = RecordId::new("chapters", chap_raw.as_str());
    let mut res = db.query(r#"
        DELETE contains WHERE out = $chap;
        RELATE $parent -> contains -> $chap SET sort_order = 0;
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

    Ok(())
}

#[tauri::command]
pub async fn reorder_node(
    project: String,
    node_type: String,
    id: String,
    sort_order: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    reorder_node_inner(&state.db, &project, &node_type, &id, sort_order).await
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
