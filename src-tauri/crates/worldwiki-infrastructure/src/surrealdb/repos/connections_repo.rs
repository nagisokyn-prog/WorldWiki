use serde_json::{json, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

pub fn format_connection(mut c: Value) -> Value {
    let source_replacement = c
        .get("source")
        .and_then(|v| v.as_str())
        .and_then(|s| s.split_once(':'))
        .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }));
    if let Some(src_val) = source_replacement
        && let Some(obj) = c.as_object_mut()
    {
        obj.insert("source".to_string(), src_val);
    }

    let target_replacement = c
        .get("target")
        .and_then(|v| v.as_str())
        .and_then(|t| t.split_once(':'))
        .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }));
    if let Some(tgt_val) = target_replacement
        && let Some(obj) = c.as_object_mut()
    {
        obj.insert("target".to_string(), tgt_val);
    }

    c
}

pub async fn get_connections(
    db: &Surreal<Db>,
    project: &str,
    chapter: Option<String>,
) -> Result<Value, DomainError> {
    let proj_clean = project.trim().trim_start_matches("projects:");
    let chap_clean = chapter
        .as_ref()
        .map(|c| c.trim().trim_start_matches("chapters:").to_string());

    let sql = "RETURN fn::get_entity_connections(fn::normalize_project_id($proj), IF $ch != NONE { type::record('chapters', $ch) } ELSE { NONE });";

    let mut res = db
        .query(sql)
        .bind(("proj", proj_clean.to_string()))
        .bind(("ch", chap_clean))
        .await
        .map_err(DomainError::constraint_violation)?;

    let connections: Vec<Value> = res.take(0).map_err(DomainError::constraint_violation)?;

    let mut formatted = Vec::with_capacity(connections.len());
    for c in connections {
        formatted.push(format_connection(c));
    }

    Ok(json!(formatted))
}

pub async fn remove_connections_by_source(
    db: &Surreal<Db>,
    _project: &str,
    _e_type: &str,
    e_id: &str,
) -> Result<usize, DomainError> {
    let clean_eid = e_id.trim_start_matches("entities:").to_string();
    let sql = "fn::remove_entity_connections(type::record('entities', $eid));";
    db.query(sql)
        .bind(("eid", clean_eid))
        .await
        .map_err(DomainError::constraint_violation)?;

    Ok(1)
}

pub async fn save_connections(
    db: &Surreal<Db>,
    project: &str,
    source_id: &str,
    data: Value,
) -> Result<(), DomainError> {
    let connections_arr = data
        .as_array()
        .ok_or_else(|| DomainError::Validation("Connections array expected".to_string()))?;
    let proj_clean = project.trim().trim_start_matches("projects:").to_string();
    let src_clean = source_id.trim().trim_start_matches("entities:").to_string();

    let sql = "RETURN fn::save_entity_connections(type::record('projects', $proj), type::record('entities', $src), $connections);";

    let mut res = db
        .query(sql)
        .bind(("proj", proj_clean))
        .bind(("src", src_clean))
        .bind(("connections", connections_arr.clone()))
        .await
        .map_err(DomainError::constraint_violation)?;

    let errs = res.take_errors();
    if !errs.is_empty() {
        return Err(DomainError::ConstraintViolation(format!(
            "save_entity_connections errors: {:?}",
            errs
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_connection_splits_source_and_target_ids() {
        let input = json!({
            "source": "character:hero_1",
            "target": "location:castle_2",
            "weight": 5
        });
        let out = format_connection(input);
        assert_eq!(out["source"], json!({ "entityType": "character", "entityId": "hero_1" }));
        assert_eq!(out["target"], json!({ "entityType": "location", "entityId": "castle_2" }));
        assert_eq!(out["weight"], json!(5));
    }

    #[test]
    fn format_connection_keeps_non_prefixed_fields() {
        let input = json!({ "source": "plain", "target": 42 });
        let out = format_connection(input);
        assert_eq!(out["source"], json!("plain"));
        assert_eq!(out["target"], json!(42));
    }
}
