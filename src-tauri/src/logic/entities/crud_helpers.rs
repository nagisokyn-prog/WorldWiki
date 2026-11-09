//! Auxiliary sanitization and retry helpers for entities CRUD.

use super::errors::EntityError;
use super::types::flatten_thing;
use crate::logic::models::Entity;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

#[inline]
pub fn sanitize_record_id<'a>(raw: &'a str, table_prefix: &str) -> &'a str {
    let clean = raw
        .trim()
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'');
    let unwrapped = if let Some((_, rest)) = clean.rsplit_once(table_prefix) {
        rest
    } else if let Some((_, rest)) = clean.rsplit_once(':') {
        rest
    } else {
        clean
    };
    unwrapped
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'')
}

#[inline]
pub fn clean_project_id(project: &str) -> String {
    sanitize_record_id(project, "projects:").to_string()
}

#[inline]
pub fn clean_entity_id(entity_id: &str) -> String {
    sanitize_record_id(entity_id, "entities:").to_string()
}

#[inline]
pub fn parse_entity_value(mut val: Value, entity_id: &str) -> Result<Option<Entity>, EntityError> {
    if val.is_null() {
        return Ok(None);
    }
    flatten_thing(&mut val);
    serde_json::from_value(val).map(Some).map_err(|e| {
        eprintln!(
            "[DESERIALIZE ERROR] get_entity_inner failed to parse entity '{}': {}",
            entity_id, e
        );
        EntityError::Serialization(e)
    })
}

pub async fn execute_delete_with_retry(
    db: &Surreal<Db>,
    actual_id: &str,
    raw_id: &str,
) -> Result<(), EntityError> {
    let mut attempts = 0;
    loop {
        match db.delete(("entities", actual_id)).await {
            Ok(deleted) => {
                let deleted: Option<Value> = deleted;
                if deleted.is_none() {
                    eprintln!(
                        "[delete_entity_inner] Entity 'entities:{}' not found for deletion (raw input: '{}')",
                        actual_id, raw_id
                    );
                } else {
                    eprintln!(
                        "[delete_entity_inner] Successfully deleted entity 'entities:{}'",
                        actual_id
                    );
                }
                return Ok(());
            }
            Err(e) => {
                let err_str = e.to_string();
                let is_retryable = err_str.contains("Transaction conflict")
                    || err_str.contains("write conflict")
                    || err_str.contains("can be retried")
                    || err_str.contains("TransactionConflict");

                if attempts < 10 && is_retryable {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(50 * attempts)).await;
                    continue;
                }
                return Err(EntityError::from(e));
            }
        }
    }
}

