use super::errors::EntityError;
use super::types::{deserialize_list, flatten_thing, safe_pid};
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
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db
        .query(format!(
            "SELECT * FROM entity_schemas WHERE project_id = '{}' OR project_id = {}",
            pid_val, pid_literal
        ))
        .await?;
    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn save_entity_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    schema: EntitySchema,
    max_saves: Option<usize>,
) -> Result<EntitySchema, EntityError> {
    let proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&schema)?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("project_id");
    }

    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);

    // FIND EXISTING SCHEMA ID
    let query_find = format!(
        "SELECT id FROM entity_schemas WHERE (project_id = '{}' OR project_id = {}) AND type_key = $t_key LIMIT 1",
        pid_val, pid_literal
    );
    let mut res = db
        .query(query_find)
        .bind(("t_key", schema.type_key.clone()))
        .await?;

    let mut existing_records: Vec<Value> = res.take(0).unwrap_or_default();

    for rec in existing_records.iter_mut() {
        flatten_thing(rec);
    }

    let actual_id_str = if let Some(first) = existing_records.first() {
        if let Some(id_val) = first.get("id") {
            let id_string = id_val.as_str().unwrap_or("");
            let parts: Vec<&str> = id_string.splitn(2, ':').collect();
            if parts.len() == 2 {
                parts[1].to_string()
            } else {
                id_string.to_string()
            }
        } else {
            "".to_string()
        }
    } else if let Some(id_str) = &schema.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let raw = if parts.len() == 2 {
            parts[1].to_string()
        } else {
            id_str.clone()
        };
        if raw.contains(&pid_raw) {
            raw
        } else {
            format!("{}_{}", pid_raw, raw)
        }
    } else {
        format!("{}_{}", pid_raw, schema.type_key)
    };

    let result: Option<Value> = if !actual_id_str.is_empty() {
        let actual_id = actual_id_str.as_str();
        let safe_actual_id = format!("entity_schemas:`{}`", actual_id);

        // --- BACKUP OLD SCHEMA ---
        let old_res: Option<Value> = db.select(("entity_schemas", actual_id)).await?;
        if let Some(old_schema_val) = old_res {
            let max_limit = max_saves.unwrap_or(30);

            let query_str = "
                BEGIN TRANSACTION;
                
                CREATE schema_history SET
                    schema_id = type::record($schema_id),
                    type_key = $type_key,
                    project_id = type::record($pid),
                    snapshot = $snapshot,
                    saved_at = $saved_at,
                    is_pinned = false;
                
                LET $target = type::record($id);
                LET $unpinned = (SELECT id, saved_at FROM schema_history WHERE schema_id = $target AND is_pinned = false ORDER BY saved_at DESC);
                IF (array::len($unpinned) > $max_limit) {
                    LET $to_delete = array::slice($unpinned, $max_limit, array::len($unpinned));
                    DELETE $to_delete;
                };
                
                COMMIT TRANSACTION;
            ";

            let mut tx_res = db
                .query(query_str)
                .bind(("schema_id", safe_actual_id.clone()))
                .bind(("type_key", schema.type_key.clone()))
                .bind(("pid", proj_id.clone()))
                .bind(("snapshot", old_schema_val))
                .bind(("saved_at", chrono::Utc::now().to_rfc3339()))
                .bind(("id", safe_actual_id.clone()))
                .bind(("max_limit", max_limit))
                .await?;

            let errors = tx_res.take_errors();
            if !errors.is_empty() {
                eprintln!("[ERROR] Schema history transaction errors: {:?}", errors);
            }
        }
        // -------------------------

        let pid_val = safe_pid(project);
        let pid_raw = pid_val.replace("projects:", "");
        let safe_pid = format!("projects:`{}`", pid_raw);
        let mut query = "
            UPSERT type::record($id) SET 
                project_id = type::record($pid),
                type_key = $t_key,
                type_name = $t_name,
                icon = $icon,
                color = $color,
                fields_schema = $fields_schema
        "
        .to_string();
        if schema.full_schema.is_some() {
            query.push_str(", full_schema = $full_schema");
        }

        let fields_val = serde_json::to_value(&schema.fields_schema).unwrap_or(Value::Array(vec![]));
        let mut q = db
            .query(query)
            .bind(("id", safe_actual_id.clone()))
            .bind(("pid", safe_pid.clone()))
            .bind(("t_key", schema.type_key.clone()))
            .bind(("t_name", schema.type_name.clone()))
            .bind(("icon", schema.icon.clone()))
            .bind(("color", schema.color.clone()))
            .bind(("fields_schema", fields_val.clone()));
        if let Some(ref fs) = schema.full_schema {
            q = q.bind(("full_schema", fs.clone()));
        }

        let mut res = q.await?;
        res.take(0)?
    } else {
        let pid_val = safe_pid(project);
        let pid_raw = pid_val.replace("projects:", "");
        let safe_pid = format!("projects:`{}`", pid_raw);
        let new_id = format!("entity_schemas:`{}_{}`", pid_raw, schema.type_key);
        let mut query = "
            CREATE type::record($id) SET 
                project_id = type::record($pid),
                type_key = $t_key,
                type_name = $t_name,
                icon = $icon,
                color = $color,
                fields_schema = $fields_schema
        "
        .to_string();
        if schema.full_schema.is_some() {
            query.push_str(", full_schema = $full_schema");
        }

        let fields_val = serde_json::to_value(&schema.fields_schema).unwrap_or(Value::Array(vec![]));
        let mut q = db
            .query(query)
            .bind(("id", new_id))
            .bind(("pid", safe_pid))
            .bind(("t_key", schema.type_key.clone()))
            .bind(("t_name", schema.type_name.clone()))
            .bind(("icon", schema.icon.clone()))
            .bind(("color", schema.color.clone()))
            .bind(("fields_schema", fields_val));
        if let Some(ref fs) = schema.full_schema {
            q = q.bind(("full_schema", fs.clone()));
        }

        let mut res = q.await?;
        res.take(0)?
    };

    match result {
        Some(val) => {
            let mut v = if let Value::Array(arr) = val {
                arr.into_iter().next().unwrap_or(Value::Null)
            } else {
                val
            };
            flatten_thing(&mut v);
            let parsed: EntitySchema = serde_json::from_value(v)?;
            Ok(parsed)
        }
        None => Err(EntityError::OperationFailed("EntitySchema not saved".to_string())),
    }
}

pub async fn delete_entity_schema_inner(
    db: &Surreal<Db>,
    project: &str,
    type_key: &str,
) -> Result<(), EntityError> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let safe_pid = format!("projects:`{}`", pid_raw);

    let mut tx_res = db
        .query(
            "
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = type::record($pid) AND rel_type IN
            (SELECT rel_key FROM relation_schemas WHERE project_id = type::record($pid) AND (from_types CONTAINS $type_key OR to_types CONTAINS $type_key));
        DELETE entities WHERE project_id = type::record($pid) AND entity_type = $type_key;
        DELETE entity_schemas WHERE project_id = type::record($pid) AND type_key = $type_key;
        COMMIT TRANSACTION;
    ",
        )
        .bind(("pid", safe_pid))
        .bind(("type_key", type_key.to_string()))
        .await?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(EntityError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}
