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
    let chap_clean = chapter.as_ref().map(|c| c.trim().trim_start_matches("chapters:").to_string());

    let sql = r#"
        RETURN fn::get_entity_connections(
            type::record('projects', $proj),
            IF $ch != NONE { type::record('chapters', $ch) } ELSE { NONE }
        );
    "#;

    let mut res = db
        .query(sql)
        .bind(("proj", proj_clean.to_string()))
        .bind(("ch", chap_clean))
        .await?;

    let connections: Vec<Value> = res.take(0)?;

    let formatted: Vec<Value> = connections
        .into_iter()
        .map(|mut c| {
            let source_replacement = c.get("source").and_then(|v| v.as_str()).and_then(|s| {
                s.split_once(':')
                    .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }))
            });
            if let Some(src_val) = source_replacement
                && let Some(obj) = c.as_object_mut() {
                    obj.insert("source".to_string(), src_val);
                }

            let target_replacement = c.get("target").and_then(|v| v.as_str()).and_then(|t| {
                t.split_once(':')
                    .map(|(e_type, e_id)| json!({ "entityType": e_type, "entityId": e_id }))
            });
            if let Some(tgt_val) = target_replacement
                && let Some(obj) = c.as_object_mut() {
                    obj.insert("target".to_string(), tgt_val);
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
    let clean_eid = e_id.trim_start_matches("entities:").to_string();
    let sql = "fn::remove_entity_connections(type::record('entities', $eid));";
    db.query(sql)
        .bind(("eid", clean_eid))
        .await?;

    Ok(1)
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
    let proj_clean = project.trim().trim_start_matches("projects:").to_string();
    let src_clean = source_id.trim().trim_start_matches("entities:").to_string();

    let sql = r#"
        fn::save_entity_connections(
            type::record('projects', $proj),
            type::record('entities', $src),
            $connections
        );
    "#;

    let mut res = db
        .query(sql)
        .bind(("proj", proj_clean))
        .bind(("src", src_clean))
        .bind(("connections", connections_arr.clone()))
        .await?;

    let errs = res.take_errors();
    if !errs.is_empty() {
        return Err(ConnectionError::Transaction(format!(
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
    fn connection_error_formatting_and_conversion() {
        let not_found = ConnectionError::NotFound("rel1".to_string());
        assert_eq!(not_found.to_string(), "Connection not found: rel1");

        let err_str: String = not_found.into();
        assert_eq!(err_str, "Connection not found: rel1");

        let inv = ConnectionError::InvalidData("no array".to_string());
        assert_eq!(inv.to_string(), "Invalid connection data: no array");
    }
}
