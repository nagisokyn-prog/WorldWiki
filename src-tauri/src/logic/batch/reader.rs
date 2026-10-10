use super::errors::BatchError;
use crate::logic::entities::deserialize_list;
use crate::logic::models::Entity;
use serde_json::{Map, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn get_entities_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_types: Vec<String>,
) -> Result<Map<String, Value>, BatchError> {
    let mut result_map = Map::new();

    if entity_types.is_empty() {
        return Ok(result_map);
    }

    let clean_pid = project.trim().replace("projects:", "");

    let mut res = db
        .query("RETURN fn::get_entities_batch(type::record('projects', $p), $types);")
        .bind(("p", clean_pid))
        .bind(("types", entity_types.clone()))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    let entities: Vec<Entity> = deserialize_list(values);

    for entity_type in entity_types {
        result_map.insert(entity_type, Value::Array(Vec::new()));
    }

    for entity in entities {
        if let Some(Value::Array(arr)) = result_map.get_mut(&entity.entity_type)
            && let Ok(val) = serde_json::to_value(entity) {
                arr.push(val);
            }
    }

    Ok(result_map)
}
