use super::errors::EntityError;
use super::types::{deserialize_list, flatten_thing};
use crate::logic::models::EntitySchema;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// ENTITY SCHEMA CRUD
// =====================================================

pub async fn get_entity_schemas_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Vec<EntitySchema>, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
    let mut res = db
        .query("RETURN fn::get_entity_schemas(type::record('projects', $p));")
        .bind(("p", clean_pid))
        .await?;
    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}

pub async fn save_entity_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    schema: EntitySchema,
    max_saves: Option<usize>,
) -> Result<EntitySchema, EntityError> {
    let clean_pid = project.trim().strip_prefix("projects:").unwrap_or(project.trim());

    // FIND EXISTING SCHEMA ID
    let mut res = db
        .query("RETURN fn::find_entity_schema_id(type::record('projects', $p), $tk);")
        .bind(("p", clean_pid))
        .bind(("tk", schema.type_key.as_str()))
        .await?;

    let found_id: Option<String> = res.take(0).unwrap_or(None);

    let actual_id_str = if let Some(id_val) = found_id {
        id_val
            .split_once(':')
            .map(|(_, b)| b.to_string())
            .unwrap_or(id_val)
    } else if let Some(ref id_str) = schema.id {
        let raw = id_str
            .split_once(':')
            .map(|(_, b)| b)
            .unwrap_or(id_str.as_str());
        if raw.contains(clean_pid) {
            raw.to_string()
        } else {
            format!("{}_{}", clean_pid, raw)
        }
    } else {
        format!("{}_{}", clean_pid, schema.type_key)
    };

    let target_raw = if !actual_id_str.is_empty() {
        actual_id_str
    } else {
        format!("{}_{}", clean_pid, schema.type_key)
    };

    // --- BACKUP OLD SCHEMA IF IT ALREADY EXISTS ---
    if !target_raw.is_empty() {
        let old_res: Option<Value> = db
            .select(("entity_schemas", target_raw.as_str()))
            .await?;
        if let Some(old_schema_val) = old_res {
            let max_limit = max_saves.unwrap_or(30) as i64;

            let _ = db
                .query("RETURN fn::record_schema_history(type::record('projects', $p), type::record('entity_schemas', $s), $tk, $snapshot, $limit);")
                .bind(("p", clean_pid))
                .bind(("s", target_raw.as_str()))
                .bind(("tk", schema.type_key.as_str()))
                .bind(("snapshot", old_schema_val))
                .bind(("limit", max_limit))
                .await;
        }
    }
    // ----------------------------------------------

    let EntitySchema {
        type_key,
        type_name,
        icon,
        color,
        fields_schema,
        full_schema,
        ..
    } = schema;

    let fields_val = serde_json::to_value(&fields_schema).unwrap_or(Value::Array(vec![]));

    let q = db
        .query("RETURN fn::save_entity_schema(type::record('entity_schemas', $id), type::record('projects', $p), $tk, $tname, $icon, $color, $fields, $full);")
        .bind(("id", target_raw))
        .bind(("p", clean_pid))
        .bind(("tk", type_key))
        .bind(("tname", type_name))
        .bind(("icon", icon))
        .bind(("color", color))
        .bind(("fields", fields_val))
        .bind(("full", full_schema));

    let mut res = q.await?;
    let result: Option<Value> = res.take(0)?;

    match result {
        Some(mut val) => {
            flatten_thing(&mut val);
            let parsed: EntitySchema = serde_json::from_value(val)?;
            Ok(parsed)
        }
        None => Err(EntityError::OperationFailed(
            "EntitySchema not saved".to_string(),
        )),
    }
}

pub async fn delete_entity_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    type_key: &str,
) -> Result<(), EntityError> {
    let clean_pid = project.trim().replace("projects:", "");

    // SurrealKV может вернуть Transaction write conflict под нагрузкой — это
    // транзиентная ошибка, которую можно повторить.
    for attempt in 0..4u32 {
        let mut tx_res = db
            .query("fn::delete_entity_schema(type::record('projects', $p), $tk);")
            .bind(("p", clean_pid.clone()))
            .bind(("tk", type_key.to_string()))
            .await?;

        let errors = tx_res.take_errors();
        if errors.is_empty() {
            return Ok(());
        }

        let err_str = format!("{:?}", errors);
        if attempt < 3 && err_str.contains("Transaction conflict") {
            tokio::time::sleep(std::time::Duration::from_millis(50 * (1 << attempt))).await;
            continue;
        }
        return Err(EntityError::Transaction(err_str));
    }

    Ok(())
}
