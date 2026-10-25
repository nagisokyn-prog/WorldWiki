use super::errors::EntityError;
use super::types::{deserialize_list, flatten_thing};
use crate::logic::models::Entity;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// ENTITY CORE CRUD
// =====================================================

pub async fn get_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
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
    let clean = id
        .split_once(':')
        .map(|(_, rest)| rest)
        .unwrap_or(id)
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim_matches('`');

    let query = "RETURN fn::get_entity(type::record('entities', $id));";
    let mut res = db
        .query(query)
        .bind(("id", clean.to_string()))
        .await?;

    let val: Option<Value> = res.take(0)?;
    if let Some(mut val) = val {
        if val.is_null() {
            return Ok(None);
        }
        flatten_thing(&mut val);
        match serde_json::from_value(val.clone()) {
            Ok(e) => return Ok(Some(e)),
            Err(e) => {
                eprintln!(
                    "[DESERIALIZE ERROR] get_entity_inner failed to parse entity '{}': {}\nRaw JSON: {:?}",
                    clean, e, val
                );
                return Err(EntityError::Serialization(e));
            }
        }
    }
    Ok(None)
}

pub async fn save_entity_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
) -> Result<Entity, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");

    let id_opt = entity.id.map(|id_str| {
        let raw = id_str.split_once(':').map(|(_, rest)| rest).unwrap_or(&id_str);
        raw.trim_matches('⟨').trim_matches('⟩').trim_matches('`').to_string()
    });

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

    let mut res = db
        .query(query)
        .bind(("id", id_opt))
        .bind(("p", clean_pid))
        .bind(("etype", entity_type))
        .bind(("name", name))
        .bind(("desc", description))
        .bind(("attrs", attributes))
        .bind(("tags", tags))
        .bind(("embeds", embeddings))
        .await?;

    let saved: Option<Value> = res.take(0)?;

    match saved {
        Some(mut v) => {
            flatten_thing(&mut v);
            let parsed: Entity = serde_json::from_value(v)?;
            Ok(parsed)
        }
        None => Err(EntityError::OperationFailed("Entity not saved".to_string())),
    }
}

pub async fn delete_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<(), EntityError> {
    let clean = id.trim().trim_matches('⟨').trim_matches('⟩').trim_matches('`').trim_matches('"').trim_matches('\'');
    let actual_id = if let Some((_, rest)) = clean.rsplit_once("entities:") {
        rest
    } else if let Some((_, rest)) = clean.rsplit_once(':') {
        rest
    } else {
        clean
    };
    let actual_id = actual_id.trim_matches('⟨').trim_matches('⟩').trim_matches('`').trim_matches('"').trim_matches('\'');

    eprintln!("[delete_entity_inner] Deleting entity raw='{}', parsed id='{}'", id, actual_id);

    let deleted: Option<Value> = db.delete(("entities", actual_id)).await?;
    if deleted.is_none() {
        eprintln!("[delete_entity_inner] Entity 'entities:{}' not found in database for deletion (raw input: '{}')", actual_id, id);
    } else {
        eprintln!("[delete_entity_inner] Successfully deleted entity 'entities:{}'", actual_id);
    }
    Ok(())
}

pub async fn search_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    query: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
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
    let clean_pid = project.trim().replace("projects:", "");
    let clean_cursor = cursor_id.map(|c| {
        let raw = c.split_once(':').map(|(_, rest)| rest).unwrap_or(&c);
        raw.trim_matches('⟨').trim_matches('⟩').trim_matches('`').to_string()
    });

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
    let clean_pid = project.trim().replace("projects:", "");
    let sql = "RETURN fn::get_entities_batch(type::record('projects', $p), $types);";

    let mut res = db
        .query(sql)
        .bind(("p", clean_pid))
        .bind(("types", types))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

