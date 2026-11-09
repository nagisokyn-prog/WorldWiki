//! Project bundle export functionality for scoped backups.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

pub(crate) async fn run_backup_query(
    db: &Surreal<Db>,
    sql: &str,
    bindings: Vec<(&str, serde_json::Value)>,
) -> Result<Vec<serde_json::Value>, DomainError> {
    let mut query = db.query(sql);
    for (k, v) in bindings {
        query = query.bind((k.to_string(), v));
    }
    let mut res = query
        .await
        .map_err(|e| DomainError::Validation(format!("Backup query execution failed: {e}")))?;
    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(DomainError::Validation(format!(
            "Backup query returned errors: {errors:?}"
        )));
    }
    let rows: Vec<serde_json::Value> = res
        .take(0)
        .map_err(|e| DomainError::Validation(format!("Failed to deserialize query result: {e}")))?;
    Ok(rows)
}

/// Exports all nodes and relation edges for a project as a structured JSON bundle.
pub(crate) async fn export_project_bundle(
    db: &Surreal<Db>,
    project_id: Option<&str>,
) -> Result<Option<serde_json::Value>, DomainError> {
    let target_proj = if let Some(target_p) = project_id {
        let rows = run_backup_query(
            db,
            "SELECT *, type::string(id) AS id_str FROM projects WHERE id = fn::normalize_project_id($pid) LIMIT 1;",
            vec![("pid", serde_json::Value::String(target_p.to_string()))],
        ).await?;
        rows.into_iter().next()
    } else {
        None
    };

    let first_proj_opt = if target_proj.is_some() {
        target_proj
    } else {
        match run_backup_query(
            db,
            "SELECT *, type::string(id) AS id_str FROM projects ORDER BY id ASC LIMIT 1;",
            vec![],
        ).await {
            Ok(rows) => rows.into_iter().next(),
            Err(e) => {
                eprintln!("[BACKUP] No active project resolved: {e}");
                None
            }
        }
    };

    let first_proj = match first_proj_opt {
        Some(p) => p,
        None => return Ok(None),
    };

    let pid_opt = first_proj
        .get("id_str")
        .and_then(|v| v.as_str())
        .or_else(|| first_proj.get("id").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .or_else(|| {
            first_proj.get("id").and_then(|id_obj| {
                if let Some(tb) = id_obj.get("tb").and_then(|v| v.as_str()) {
                    let id_val = id_obj.get("id")?;
                    let id_s = id_val.as_str().map(|s| s.to_string()).unwrap_or_else(|| id_val.to_string().trim_matches('"').to_string());
                    Some(format!("{tb}:{id_s}"))
                } else {
                    None
                }
            })
        });

    let pid_str = match pid_opt {
        Some(s) => s,
        None => return Ok(None),
    };

    let p_rec = pid_str.as_str();

    // 1. Volumes
    let volumes = run_backup_query(
        db,
        "SELECT *, type::string(id) AS id FROM volumes WHERE project_id = fn::normalize_project_id($pid);",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;
    let vol_ids: Vec<serde_json::Value> = volumes.iter().filter_map(|v| v.get("id")).cloned().collect();

    // 2. Chapters
    let chapters = run_backup_query(
        db,
        "SELECT *, type::string(id) AS id, type::string(volume_id) AS volume_id FROM chapters WHERE volume_id.project_id = fn::normalize_project_id($pid) OR volume_id IN $vols;",
        vec![
            ("pid", serde_json::Value::String(p_rec.to_string())),
            ("vols", serde_json::Value::Array(vol_ids.clone())),
        ],
    ).await?;

    // 3. Contains (filtered: only edges with existing valid in/out)
    let contains = run_backup_query(
        db,
        "SELECT * FROM contains WHERE (in = fn::normalize_project_id($pid) OR in IN $vols OR in.project_id = fn::normalize_project_id($pid)) AND in != NONE AND out != NONE;",
        vec![
            ("pid", serde_json::Value::String(p_rec.to_string())),
            ("vols", serde_json::Value::Array(vol_ids.clone())),
        ],
    ).await?;
    let sanitized_contains: Vec<serde_json::Value> = contains
        .into_iter()
        .filter(|edge| {
            let has_in = edge.get("in").and_then(|v| v.as_str()).is_some()
                || edge.get("in").and_then(|v| v.get("tb")).is_some();
            let has_out = edge.get("out").and_then(|v| v.as_str()).is_some()
                || edge.get("out").and_then(|v| v.get("tb")).is_some();
            has_in && has_out
        })
        .collect();

    // 4. Entity Schemas
    let entity_schemas = run_backup_query(
        db,
        "SELECT * FROM entity_schemas WHERE project_id = fn::normalize_project_id($pid) AND string::starts_with(type::string(id), 'entity_schemas:default_') = false;",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;
    let schema_ids: Vec<serde_json::Value> = entity_schemas.iter().filter_map(|s| s.get("id")).cloned().collect();

    // 5. Relation Schemas
    let relation_schemas = run_backup_query(
        db,
        "SELECT * FROM relation_schemas WHERE project_id = fn::normalize_project_id($pid);",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;

    // 6. Entities
    let entities = run_backup_query(
        db,
        "SELECT * FROM entities WHERE project_id = fn::normalize_project_id($pid) OR schema_id.project_id = fn::normalize_project_id($pid) OR schema_id IN $schemas;",
        vec![
            ("pid", serde_json::Value::String(p_rec.to_string())),
            ("schemas", serde_json::Value::Array(schema_ids)),
        ],
    ).await?;

    // 7. Entity Rel (strictly between entities of this project and valid in/out)
    let entity_rel = run_backup_query(
        db,
        "SELECT * FROM entity_rel WHERE (in.project_id = fn::normalize_project_id($pid) OR in.schema_id.project_id = fn::normalize_project_id($pid)) AND (out.project_id = fn::normalize_project_id($pid) OR out.schema_id.project_id = fn::normalize_project_id($pid)) AND in != NONE AND out != NONE;",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;

    // 8. Timeline Events
    let timeline_events = run_backup_query(
        db,
        "SELECT * FROM timeline_events WHERE project_id = fn::normalize_project_id($pid);",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;

    // 9. Participates in
    let participates_in = run_backup_query(
        db,
        "SELECT * FROM participates_in WHERE (in.project_id = fn::normalize_project_id($pid) OR in.schema_id.project_id = fn::normalize_project_id($pid)) AND in != NONE AND out != NONE;",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;

    // 10. Appears in
    let appears_in = run_backup_query(
        db,
        "SELECT * FROM appears_in WHERE (in.project_id = fn::normalize_project_id($pid) OR in.schema_id.project_id = fn::normalize_project_id($pid)) AND in != NONE AND out != NONE;",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;

    // 11. Planets
    let planets = run_backup_query(
        db,
        "SELECT * FROM planets WHERE project_id = fn::normalize_project_id($pid);",
        vec![("pid", serde_json::Value::String(p_rec.to_string()))],
    ).await?;
    let planet_ids: Vec<serde_json::Value> = planets.iter().filter_map(|p| p.get("id")).cloned().collect();

    // 12. Calendars
    let calendars = run_backup_query(
        db,
        "SELECT * FROM calendars WHERE planet_id IN $planets OR planet_id.project_id = fn::normalize_project_id($pid);",
        vec![
            ("planets", serde_json::Value::Array(planet_ids)),
            ("pid", serde_json::Value::String(p_rec.to_string())),
        ],
    ).await?;

    let mut clean_project = first_proj;
    if let Some(map) = clean_project.as_object_mut() {
        map.remove("id_str");
        map.remove("updated_at");
    }

    let bundle = serde_json::json!({
        "project": clean_project,
        "volumes": volumes,
        "chapters": chapters,
        "contains": sanitized_contains,
        "entity_schemas": entity_schemas,
        "relation_schemas": relation_schemas,
        "entities": entities,
        "entity_rel": entity_rel,
        "timeline_events": timeline_events,
        "participates_in": participates_in,
        "appears_in": appears_in,
        "planets": planets,
        "calendars": calendars,
    });

    Ok(Some(bundle))
}
