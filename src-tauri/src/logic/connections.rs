use serde_json::{json, Value};

#[tauri::command]
pub async fn get_connections(
    project: String,
    chapter: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    let mut sql = "SELECT *, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id FROM entity_rel WHERE project_id = $proj OR project_id = type::record($proj)".to_string();
    
    if chapter.is_some() {
        sql.push_str(" AND (start_chapter = $ch OR end_chapter = $ch)");
    }

    let mut q = db.query(sql).bind(json!({ "proj": proj_id }));
    if let Some(ch) = chapter {
        q = q.bind(json!({ "ch": ch }));
    }

    let mut res = q.await.map_err(|e| e.to_string())?;
    let connections: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    
    let formatted: Vec<Value> = connections.into_iter().map(|mut c| {
        if let Some(s) = c["source"].as_str() {
            let parts: Vec<&str> = s.split(':').collect();
            if parts.len() >= 2 {
                c["source"] = json!({ "entityType": parts[0], "entityId": parts[1] });
            }
        }
        if let Some(t) = c["target"].as_str() {
            let parts: Vec<&str> = t.split(':').collect();
            if parts.len() >= 2 {
                c["target"] = json!({ "entityType": parts[0], "entityId": parts[1] });
            }
        }
        c
    }).collect();

    Ok(json!(formatted))
}

#[tauri::command]
pub async fn remove_connections_by_source(
    _project: String,
    _e_type: String,
    e_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<usize, String> {
    let db = &state.db;
    // Entities now use `entities:` prefix
    let rid = format!("entities:{}", e_id);
    let mut res = db.query("DELETE entity_rel WHERE in = type::record($rid) OR out = type::record($rid)")
        .bind(json!({ "rid": rid }))
        .await.map_err(|e| e.to_string())?;
    
    let deleted: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deleted.len())
}

#[tauri::command]
pub async fn save_connections(
    project: String,
    data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let connections_arr = data.as_array().ok_or("Connections array expected")?;
    let proj_id = format!("projects:{}", project);

    db.query("DELETE entity_rel WHERE project_id = $proj OR project_id = type::record($proj)")
        .bind(json!({ "proj": proj_id.clone() }))
        .await.map_err(|e| e.to_string())?;

    for c in connections_arr {
        let s_id = c["source"]["entityId"].as_str().unwrap_or("");
        let t_id = c["target"]["entityId"].as_str().unwrap_or("");
        
        if s_id.is_empty() || t_id.is_empty() { continue; }

        let sql = "RELATE $from -> entity_rel -> $to SET 
            project_id = $proj,
            rel_type = $role,
            description = $desc,
            start_chapter = $start,
            end_chapter = $end,
            created_at = time::now()";

        // Mapping frontend "role" to "rel_type"
        db.query(sql)
            .bind(json!({
                "from": format!("entities:{}", s_id),
                "to": format!("entities:{}", t_id),
                "proj": proj_id.clone(),
                "role": c["role"].as_str().unwrap_or(""),
                "desc": c["description"].as_str().unwrap_or(""),
                "start": c["period"]["start_chapter"].as_str().unwrap_or(""),
                "end": c["period"]["end_chapter"].as_str().unwrap_or("")
            }))
            .await.map_err(|e| e.to_string())?;
    }

    Ok(())
}