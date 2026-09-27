use super::errors::EntityError;
use super::types::{deserialize_list, SchemaHistoryEntry};
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// ENTITY & SCHEMA HISTORY / REVISIONS CRUD
// =====================================================

pub async fn get_schema_history_inner(
    db: &Surreal<Db>,
    project: &str,
    type_key: &str,
) -> Result<Vec<SchemaHistoryEntry>, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
    let mut res = db
        .query("RETURN fn::get_schema_history(type::record('projects', $pid), $tk);")
        .bind(("pid", clean_pid))
        .bind(("tk", type_key.to_string()))
        .await?;
    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}

pub async fn toggle_schema_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), EntityError> {
    let actual_id = history_id.split_once(':').map(|(_, b)| b).unwrap_or(history_id);
    db.query("fn::toggle_pin(type::record('schema_history', $id), $is_pinned);")
        .bind(("id", actual_id))
        .bind(("is_pinned", is_pinned))
        .await?;
    Ok(())
}

pub async fn get_entity_revisions_inner(
    db: &Surreal<Db>,
    entity_id: &str,
) -> Result<Vec<Value>, EntityError> {
    let actual_id = entity_id.split_once(':').map(|(_, b)| b).unwrap_or(entity_id);
    let mut result = db
        .query("RETURN fn::get_entity_revisions(type::record('entities', $id));")
        .bind(("id", actual_id))
        .await?;

    let revisions: Vec<Value> = result.take(0).unwrap_or_default();
    Ok(revisions)
}

pub async fn toggle_entity_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), EntityError> {
    let actual_id = history_id.split_once(':').map(|(_, b)| b).unwrap_or(history_id);
    db.query("fn::toggle_pin(type::record('entity_revisions', $id), $is_pinned);")
        .bind(("id", actual_id))
        .bind(("is_pinned", is_pinned))
        .await?;
    Ok(())
}
