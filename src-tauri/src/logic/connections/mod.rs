use serde_json::{json, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub mod commands;
pub mod errors;

pub use commands::*;
pub use errors::*;

pub async fn get_connections_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter: Option<String>,
) -> Result<Value, ConnectionError> {
    let proj_clean = project.trim().trim_start_matches("projects:");
    let proj_id = format!("projects:{}", proj_clean);

    let mut sql = String::from(
        "SELECT *, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id \
         FROM entity_rel WHERE project_id = type::record($proj)",
    );

    if chapter.is_some() {
        sql.push_str(" AND (start_chapter = type::record($ch) OR end_chapter = type::record($ch))");
    }

    let mut q = db.query(sql).bind(("proj", proj_id));
    if let Some(ch) = chapter {
        q = q.bind(("ch", ch));
    }

    let mut res = q.await?;
    let connections: Vec<Value> = res.take(0)?;

    let formatted: Vec<Value> = connections
        .into_iter()
        .map(|mut c| {
            let source_replacement = c.get("source").and_then(|v| v.as_str()).and_then(|s| {
                s.split_once(':')
                    .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }))
            });
            if let Some(src_val) = source_replacement {
                if let Some(obj) = c.as_object_mut() {
                    obj.insert("source".to_string(), src_val);
                }
            }

            let target_replacement = c.get("target").and_then(|v| v.as_str()).and_then(|t| {
                t.split_once(':')
                    .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }))
            });
            if let Some(tgt_val) = target_replacement {
                if let Some(obj) = c.as_object_mut() {
                    obj.insert("target".to_string(), tgt_val);
                }
            }

            c
        })
        .collect();

    Ok(json!(formatted))
}

pub async fn remove_connections_by_source_inner(
    db: &Surreal<Db>,
    _project: &str,
    _e_type: &str,
    e_id: &str,
) -> Result<usize, ConnectionError> {
    let rid = format!("entities:{}", e_id.trim_start_matches("entities:"));
    let mut res = db
        .query("DELETE entity_rel WHERE in = type::record($rid) RETURN BEFORE")
        .bind(("rid", rid))
        .await?;

    let deleted: Vec<Value> = res.take(0)?;
    Ok(deleted.len())
}

pub async fn save_connections_inner(
    db: &Surreal<Db>,
    project: &str,
    source_id: &str,
    data: Value,
) -> Result<(), ConnectionError> {
    let connections_arr = data
        .as_array()
        .ok_or_else(|| ConnectionError::InvalidData("Connections array expected".to_string()))?;
    let proj_clean = project.trim().trim_start_matches("projects:");
    let proj_id = format!("projects:{}", proj_clean);
    let src_rid = format!("entities:{}", source_id.trim_start_matches("entities:"));

    db.query(
        "DELETE entity_rel WHERE (in = type::record($src) OR out = type::record($src)) AND project_id = type::record($proj)",
    )
    .bind(("proj", proj_id.clone()))
    .bind(("src", src_rid))
    .await?;

    for c in connections_arr {
        let s_id_raw = c
            .get("source")
            .and_then(|v| v.get("entityId"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let t_id_raw = c
            .get("target")
            .and_then(|v| v.get("entityId"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let s_id = s_id_raw.trim_start_matches("entities:");
        let t_id = t_id_raw.trim_start_matches("entities:");

        if s_id.is_empty() || t_id.is_empty() {
            continue;
        }

        let mut set_clauses = vec![
            "project_id = type::record($proj)".to_string(),
            "rel_type = $role".to_string(),
            "description = $desc".to_string(),
            "created_at = time::now()".to_string(),
        ];

        let start = c
            .get("period")
            .and_then(|v| v.get("start_chapter"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let end = c
            .get("period")
            .and_then(|v| v.get("end_chapter"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !start.is_empty() {
            set_clauses.push("start_chapter = type::record($start)".to_string());
        }
        if !end.is_empty() {
            set_clauses.push("end_chapter = type::record($end)".to_string());
        }

        let role_val = c.get("role").and_then(|v| v.as_str()).unwrap_or("");
        let desc_val = c.get("description").and_then(|v| v.as_str()).unwrap_or("");

        let sql = format!(
            "RELATE $src_node -> entity_rel -> $tgt_node SET {}",
            set_clauses.join(", ")
        );

        let src_record = surrealdb::types::RecordId::new("entities", s_id);
        let tgt_record = surrealdb::types::RecordId::new("entities", t_id);

        let mut q = db
            .query(sql)
            .bind(("src_node", src_record))
            .bind(("tgt_node", tgt_record))
            .bind(("proj", proj_id.clone()))
            .bind(("role", role_val))
            .bind(("desc", desc_val));

        if !start.is_empty() {
            q = q.bind(("start", start));
        }
        if !end.is_empty() {
            q = q.bind(("end", end));
        }

        let mut res = q.await?;
        let errs = res.take_errors();
        if !errs.is_empty() {
            return Err(ConnectionError::Transaction(format!(
                "entity_rel RELATE errors: {:?}",
                errs
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connection_error_formatting_and_conversion() {
        let not_found = ConnectionError::NotFound("rel1".to_string());
        assert_eq!(not_found.to_string(), "Connection not found: rel1");

        let err_str: String = not_found.into();
        assert_eq!(err_str, "Connection not found: rel1");

        let inv = ConnectionError::InvalidData("no array".to_string());
        assert_eq!(inv.to_string(), "Invalid connection data: no array");
    }
}
