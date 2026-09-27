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

    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}

pub async fn get_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<Option<Entity>, EntityError> {
    let actual_id = id.split_once(':').map(|(_, rest)| rest).unwrap_or(id);
    let res: Option<Value> = db.select(("entities", actual_id)).await?;

    if let Some(mut val) = res {
        flatten_thing(&mut val);
        match serde_json::from_value(val) {
            Ok(e) => return Ok(Some(e)),
            Err(e) => {
                eprintln!("[DEBUG get_entity] error: {}", e);
                return Ok(None);
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
    let actual_id = id.split_once(':').map(|(_, rest)| rest).unwrap_or(id).trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    let _: Option<Value> = db.delete(("entities", actual_id)).await?;
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

    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}
