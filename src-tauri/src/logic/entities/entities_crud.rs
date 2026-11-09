use super::errors::EntityError;
use super::types::{deserialize_list, flatten_thing};
use crate::logic::models::Entity;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub use super::crud_helpers::*;

// =====================================================
// ENTITY CORE CRUD
// =====================================================

pub async fn get_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = clean_project_id(project);
    let query = "RETURN fn::get_entities(type::record('projects', $p), $et);";
    let mut res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("et", entity_type))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn get_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<Option<Entity>, EntityError> {
    let actual_id = clean_entity_id(id);
    let query = "RETURN fn::get_entity(type::record('entities', $id));";
    let mut res = db
        .query(query)
        .bind(("id", actual_id.clone()))
        .await?;

    let val: Option<Value> = res.take(0)?;
    if let Some(v) = val {
        parse_entity_value(v, &actual_id)
    } else {
        Ok(None)
    }
}

pub async fn save_entity_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
) -> Result<Entity, EntityError> {
    let clean_pid = clean_project_id(project);
    let id_opt = entity.id.as_deref().map(clean_entity_id);

    let Entity {
        entity_type,
        name,
        description,
        attributes,
        tags,
        embeddings,
        ..
    } = entity;

    let query = "RETURN fn::save_entity(IF $id != NONE { type::record('entities', $id) } ELSE { NONE }, type::record('projects', $p), $etype, $name, $desc, $attrs, $tags, $embeds);";

    let mut attempts = 0;
    loop {
        let res = db
            .query(query)
            .bind(("id", id_opt.as_deref()))
            .bind(("p", clean_pid.as_str()))
            .bind(("etype", entity_type.as_str()))
            .bind(("name", name.as_str()))
            .bind(("desc", description.as_deref()))
            .bind(("attrs", attributes.clone()))
            .bind(("tags", tags.clone()))
            .bind(("embeds", embeddings.clone()))
            .await;

        match res {
            Ok(mut query_res) => {
                let saved_res: Result<Option<Value>, _> = query_res.take(0);
                match saved_res {
                    Ok(Some(mut v)) => {
                        flatten_thing(&mut v);
                        let parsed: Entity = serde_json::from_value(v)?;
                        return Ok(parsed);
                    }
                    Ok(None) => {
                        return Err(EntityError::OperationFailed("Entity not saved".to_string()))
                    }
                    Err(e) => {
                        let err_str = e.to_string();
                        let is_retryable = err_str.contains("Transaction conflict")
                            || err_str.contains("write conflict")
                            || err_str.contains("can be retried")
                            || err_str.contains("TransactionConflict");

                        if attempts < 10 && is_retryable {
                            attempts += 1;
                            tokio::time::sleep(tokio::time::Duration::from_millis(20 * attempts))
                                .await;
                            continue;
                        }
                        return Err(EntityError::from(e));
                    }
                }
            }
            Err(e) => {
                let err_str = e.to_string();
                let is_retryable = err_str.contains("Transaction conflict")
                    || err_str.contains("write conflict")
                    || err_str.contains("can be retried")
                    || err_str.contains("TransactionConflict");

                if attempts < 10 && is_retryable {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(20 * attempts)).await;
                    continue;
                }
                return Err(EntityError::from(e));
            }
        }
    }
}

pub async fn delete_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<(), EntityError> {
    let actual_id = clean_entity_id(id);
    eprintln!(
        "[delete_entity_inner] Deleting entity raw='{}', parsed id='{}'",
        id, actual_id
    );
    execute_delete_with_retry(db, &actual_id, id).await
}

pub async fn search_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    query: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = clean_project_id(project);
    let sql = "RETURN fn::search_entities(type::record('projects', $p), $q, $et);";

    let mut res = db
        .query(sql)
        .bind(("p", clean_pid))
        .bind(("q", query.to_string()))
        .bind(("et", entity_type))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn get_entities_cursor_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_type: Option<String>,
    cursor_id: Option<String>,
    limit: i64,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = clean_project_id(project);
    let clean_cursor = cursor_id.as_deref().map(clean_entity_id);

    let sql = "RETURN fn::get_entities_cursor(type::record('projects', $p), $et, IF $cursor != NONE { type::record('entities', $cursor) } ELSE { NONE }, $limit);";
    let mut res = db
        .query(sql)
        .bind(("p", clean_pid))
        .bind(("et", entity_type))
        .bind(("cursor", clean_cursor))
        .bind(("limit", limit))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn get_entities_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    types: Vec<String>,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = clean_project_id(project);
    let sql = "RETURN fn::get_entities_batch(type::record('projects', $p), $types);";

    let mut res = db
        .query(sql)
        .bind(("p", clean_pid))
        .bind(("types", types))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}
