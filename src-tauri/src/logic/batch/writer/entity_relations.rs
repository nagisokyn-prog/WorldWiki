use crate::logic::batch::errors::BatchError;
use crate::logic::entities::flatten_thing;
use crate::logic::models::Entity;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn save_entity_with_relations_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
    foreign_updates: Vec<Entity>,
) -> Result<Entity, BatchError> {
    let clean_pid = project.trim().replace("projects:", "");

    let Entity {
        id: entity_id_opt,
        entity_type,
        name,
        description,
        attributes,
        tags,
        embeddings,
        ..
    } = entity;

    let main_entity_id = if let Some(ref id_str) = entity_id_opt {
        let actual_id = id_str
            .split_once(':')
            .map(|(_, b)| b)
            .unwrap_or(id_str.as_str());
        actual_id
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim_matches('`')
            .to_string()
    } else {
        uuid::Uuid::new_v4().to_string()
    };

    let main_entity_obj = serde_json::json!({
        "entity_type": entity_type,
        "name": name,
        "description": description,
        "attributes": attributes,
        "tags": tags,
        "embeddings": embeddings,
    });

    let foreign_objs: Vec<serde_json::Value> = foreign_updates
        .into_iter()
        .filter_map(|f| {
            let fid_str = f.id?;
            let factual_id = fid_str.split_once(':').map(|(_, b)| b).unwrap_or(&fid_str);
            let clean_fid = factual_id
                .trim_matches('⟨')
                .trim_matches('⟩')
                .trim_matches('`')
                .to_string();

            Some(serde_json::json!({
                "id": clean_fid,
                "entity_type": f.entity_type,
                "name": f.name,
                "description": f.description,
                "attributes": f.attributes,
                "tags": f.tags,
                "embeddings": f.embeddings,
            }))
        })
        .collect();

    let query = "RETURN fn::batch_save_entity_with_relations(type::record('projects', $p), type::record('entities', $main_id), $main_entity, $foreign);";

    let mut res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("main_id", main_entity_id))
        .bind(("main_entity", main_entity_obj))
        .bind(("foreign", foreign_objs))
        .await?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(BatchError::Transaction(format!("{:?}", errors)));
    }

    let saved_val: Option<Value> = res.take(0)?;

    if let Some(mut v) = saved_val {
        flatten_thing(&mut v);
        return Ok(serde_json::from_value(v)?);
    }

    Err(BatchError::OperationFailed(
        "Failed to retrieve saved entity from transaction".to_string(),
    ))
}
