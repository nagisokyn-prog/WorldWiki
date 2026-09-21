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
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db
        .query(format!(
            "SELECT * FROM relation_schemas WHERE project_id = '{}' OR project_id = {}",
            pid_val, pid_literal
        ))
        .await?;
    let values: Vec<Value> = res.take(0)?;
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
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 {
            parts[1]
        } else {
            id_str.as_str()
        };
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
    let proj_id = format!("projects:{}", project);
    let mut tx_res = db
        .query(
            "
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = $pid AND rel_type = $rel_key;
        DELETE relation_schemas WHERE project_id = $pid AND rel_key = $rel_key;
        COMMIT TRANSACTION;
    ",
        )
        .bind(("pid", proj_id))
        .bind(("rel_key", rel_key))
        .await?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(EntityError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}
