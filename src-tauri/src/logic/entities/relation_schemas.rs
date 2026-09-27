use super::errors::EntityError;
use super::types::*;
use crate::logic::models::RelationSchema;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn get_relation_schemas_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Vec<RelationSchema>, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
    let mut res = db
        .query("RETURN fn::get_relation_schemas(type::record('projects', $p));")
        .bind(("p", clean_pid))
        .await?;
    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}

pub async fn save_relation_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    schema: RelationSchema,
) -> Result<RelationSchema, EntityError> {
    let proj_id = format!("projects:{}", project);
    let mut val = serde_json::to_value(&schema)?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.insert("project_id".into(), Value::String(proj_id));
    }

    let result: Option<Value> = if let Some(id_str) = &schema.id {
        let actual_id = id_str.split_once(':').map(|(_, b)| b).unwrap_or(id_str.as_str());
        db.upsert(("relation_schemas", actual_id))
            .merge(val)
            .await?
    } else {
        db.create("relation_schemas")
            .content(val)
            .await?
    };

    match result {
        Some(v) => Ok(serde_json::from_value(v)?),
        None => Err(EntityError::OperationFailed(
            "RelationSchema not saved".to_string(),
        )),
    }
}

pub async fn delete_relation_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    rel_key: &str,
) -> Result<(), EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
    let mut tx_res = db
        .query("fn::delete_relation_schema(type::record('projects', $p), $rel_key);")
        .bind(("p", clean_pid))
        .bind(("rel_key", rel_key))
        .await?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(EntityError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}
