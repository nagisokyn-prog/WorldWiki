use surrealdb::types::RecordId;

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    let db = &state.db;
    let proj_rec = RecordId::new("projects", project.as_str());

    // Получаем тома и их порядок через ребро contains от проекта
    let mut volumes_res = db.query(r#"
        SELECT id, title, project_id,
        (SELECT VALUE sort_order FROM <-contains WHERE in = $proj)[0] AS sort_order
        FROM volumes WHERE project_id = $proj
    "#).bind(("proj", proj_rec.clone())).await.map_err(|e| e.to_string())?;
    let mut volumes: Vec<serde_json::Value> = volumes_res.take(0).unwrap_or_default();
    volumes.sort_by_key(|v| v["sort_order"].as_i64().unwrap_or(0));

    // Получаем арки, их родительский том и порядок
    let mut arcs_res = db.query(r#"
        SELECT id, title, project_id,
        (SELECT VALUE in FROM <-contains WHERE record::tb(in) = 'volumes')[0] AS volume_id,
        (SELECT VALUE sort_order FROM <-contains WHERE record::tb(in) = 'volumes')[0] AS sort_order
        FROM arcs WHERE project_id = $proj
    "#).bind(("proj", proj_rec.clone())).await.map_err(|e| e.to_string())?;
    let mut arcs: Vec<serde_json::Value> = arcs_res.take(0).unwrap_or_default();
    arcs.sort_by_key(|a| a["sort_order"].as_i64().unwrap_or(0));

    // Получаем главы, их родителей и порядок
    let mut chapters_res = db.query(r#"
        SELECT *,
        (SELECT VALUE in FROM <-contains WHERE record::tb(in) = 'arcs')[0] AS arc_id,
        (SELECT VALUE in FROM <-contains WHERE record::tb(in) = 'volumes')[0] AS volume_id,
        (SELECT VALUE sort_order FROM <-contains)[0] AS sort_order
        FROM chapters WHERE project_id = $proj
    "#).bind(("proj", proj_rec.clone())).await.map_err(|e| e.to_string())?;
    let mut chapters: Vec<serde_json::Value> = chapters_res.take(0).unwrap_or_default();
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
    let db = &state.db;
    let proj_rec = RecordId::new("projects", project.as_str());
    
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
    "#).bind(("proj", proj_rec.clone())).bind(("title", title)).bind(("order", next_order)).await.map_err(|e| e.to_string())?;
    
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
    let db = &state.db;
    let clean_id = if id.contains(':') { id } else { format!("volumes:{}", id) };
    db.query("UPDATE type::record($id) SET title = $title")
        .bind(("id", clean_id))
        .bind(("title", title))
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
    let db = &state.db;
    let proj_rec = RecordId::new("projects", project.as_str());
    let parent_str = volume_id.unwrap_or_else(|| format!("projects:{}", project));
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
    .bind(("title", title))
    .bind(("order", next_order))
    .await.map_err(|e| e.to_string())?;
    
    let arcs: Vec<serde_json::Value> = create_res.take(2).unwrap_or_default();
    Ok(serde_json::json!(arcs.first()))
}

#[tauri::command]
pub async fn update_arc(
    _project: String,
    id: String,
    title: String,
    _volume_id: Option<String>, // Для смены тома потребуется отдельная логика перемещения ребра
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let clean_id = if id.contains(':') { id } else { format!("arcs:{}", id) };
    db.query("UPDATE type::record($id) SET title = $title")
        .bind(("id", clean_id))
        .bind(("title", title))
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
    let db = &state.db;
    let clean_chap = if chapter_id.contains(':') { chapter_id } else { format!("chapters:{}", chapter_id) };
    
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
        RecordId::new("projects", project.as_str())
    };

    // Удаляем старые связи и создаем новую
    let chap_raw = clean_chap.split(':').nth(1).unwrap_or(&clean_chap).to_string();
    let chap_rec = RecordId::new("chapters", chap_raw.as_str());
    db.query(r#"
        DELETE <-contains WHERE out = $chap;
        RELATE $parent -> contains -> $chap SET sort_order = 0;
    "#)
    .bind(("chap", chap_rec))
    .bind(("parent", new_parent))
    .await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn reorder_node(
    project: String,
    node_type: String, // "volume", "arc", "chapter"
    id: String,
    sort_order: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let _ = project;
    let clean_id = if id.contains(':') { id.clone() } else { format!("{}s:{}", node_type, id) };
    
    // Обновляем sort_order на входящем ребре contains
    db.query("UPDATE <-contains WHERE out = type::record($id) SET sort_order = $order")
        .bind(("id", clean_id))
        .bind(("order", sort_order))
        .await.map_err(|e| e.to_string())?;
        
    Ok(())
}
