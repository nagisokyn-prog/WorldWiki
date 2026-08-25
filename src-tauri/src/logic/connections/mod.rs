use serde_json::{json, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// IPC layer extracted (architecture split):
mod commands;
pub use commands::*;


pub async fn get_connections_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter: Option<String>,
) -> Result<Value, String> {
    let proj_id = format!("projects:{}", project.trim().replace("projects:", ""));
    let proj_raw = project.trim().replace("projects:", "");
    let proj_literal = format!("projects:`{}`", proj_raw);
    let mut sql = format!("SELECT *, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id FROM entity_rel WHERE project_id = '{}' OR project_id = {}", proj_id, proj_literal);
    
    if chapter.is_some() {
        sql.push_str(" AND (start_chapter = type::record($ch) OR end_chapter = type::record($ch))");
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


pub async fn remove_connections_by_source_inner(
    db: &Surreal<Db>,
    _project: &str,
    _e_type: &str,
    e_id: &str,
) -> Result<usize, String> {
    let rid = format!("entities:{}", e_id.strip_prefix("entities:").unwrap_or(e_id));
    // When manually requested by source, only delete outgoing relationships!
    // If the entity is being fully deleted, we'd delete both, but this is used for saving.
    let mut res = db.query("DELETE entity_rel WHERE in = type::record($rid) RETURN BEFORE")
        .bind(json!({ "rid": rid }))
        .await.map_err(|e| e.to_string())?;
    
    let deleted: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deleted.len())
}


pub async fn save_connections_inner(
    db: &Surreal<Db>,
    project: &str,
    source_id: &str,
    data: Value,
) -> Result<(), String> {
    let connections_arr = data.as_array().ok_or("Connections array expected")?;
    let proj_id = format!("projects:{}", project.trim().replace("projects:", ""));
    let src_rid = format!("entities:{}", source_id.strip_prefix("entities:").unwrap_or(source_id));

    // Удаляем все связи, где текущая сущность является источником ИЛИ целью
    let proj_raw = project.trim().replace("projects:", "");
    let proj_literal = format!("projects:`{}`", proj_raw);
    db.query(format!("DELETE entity_rel WHERE (in = type::record($src) OR out = type::record($src)) AND (project_id = '{}' OR project_id = {})", proj_id, proj_literal))
        .bind(json!({ "proj": proj_id.clone(), "src": src_rid }))
        .await.map_err(|e| e.to_string())?;

    for c in connections_arr {
        let mut s_id = c["source"]["entityId"].as_str().unwrap_or("").to_string();
        let mut t_id = c["target"]["entityId"].as_str().unwrap_or("").to_string();
        
        if s_id.starts_with("entities:") { s_id = s_id.replace("entities:", ""); }
        if t_id.starts_with("entities:") { t_id = t_id.replace("entities:", ""); }
        
        if s_id.is_empty() || t_id.is_empty() { continue; }

        // RELATE требует record-литералы в граф-вершинах (type::record() тут не парсится),
        // поэтому подставляем record id инлайн — как в работающем upsert_connections_batch.
        // start/end_chapter ставим через type::record() и только если не пустые (иначе SCHEMAFULL
        // отклоняет пустую строку/record из NULL).
        let mut set_clauses = vec![
            "project_id = type::record($proj)".to_string(),
            "rel_type = $role".to_string(),
            "description = $desc".to_string(),
            "created_at = time::now()".to_string(),
        ];

        let start = c["period"]["start_chapter"].as_str().unwrap_or("");
        let end = c["period"]["end_chapter"].as_str().unwrap_or("");
        if !start.is_empty() {
            set_clauses.push("start_chapter = type::record($start)".to_string());
        }
        if !end.is_empty() {
            set_clauses.push("end_chapter = type::record($end)".to_string());
        }

        let sql = format!(
            "RELATE entities:{} -> entity_rel -> entities:{} SET {}",
            s_id,
            t_id,
            set_clauses.join(", ")
        );

        // Mapping frontend "role" to "rel_type"
        let mut bind = json!({
            "proj": proj_id.clone(),
            "role": c["role"].as_str().unwrap_or(""),
            "desc": c["description"].as_str().unwrap_or("")
        });
        if !start.is_empty() {
            bind["start"] = Value::String(start.to_string());
        }
        if !end.is_empty() {
            bind["end"] = Value::String(end.to_string());
        }

        let mut res = db.query(sql).bind(bind).await.map_err(|e| e.to_string())?;
        let errs = res.take_errors();
        if !errs.is_empty() {
            return Err(format!("entity_rel RELATE errors: {:?}", errs));
        }
    }

    Ok(())
}
