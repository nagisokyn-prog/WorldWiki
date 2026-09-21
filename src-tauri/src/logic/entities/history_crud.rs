use super::errors::EntityError;
use super::types::{deserialize_list, safe_id, SchemaHistoryEntry};
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
    let pid = format!("projects:{}", project);
    let mut res = db
        .query("SELECT * FROM schema_history WHERE project_id = type::record($pid) AND type_key = $tk ORDER BY saved_at DESC")
        .bind(("pid", pid))
        .bind(("tk", type_key.to_string()))
        .await?;
    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn toggle_schema_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), EntityError> {
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        history_id
    };

    let id_val = safe_id("schema_history", actual_id);
    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", id_val))
        .bind(("is_pinned", is_pinned))
        .await?;
    Ok(())
}

pub async fn get_entity_revisions_inner(
    db: &Surreal<Db>,
    entity_id: &str,
) -> Result<Vec<Value>, EntityError> {
    let parts: Vec<&str> = entity_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        entity_id
    };
    let full_id = format!("entities:⟨{}⟩", actual_id);

    let mut result = db
        .query("SELECT * FROM entity_revisions WHERE target_id = type::record($target_id) ORDER BY created_at DESC")
        .bind(("target_id", full_id))
        .await?;

    let revisions: Vec<Value> = result.take(0)?;
    Ok(revisions)
}

pub async fn toggle_entity_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), EntityError> {
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        history_id
    };

    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("entity_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await?;

    Ok(())
}
