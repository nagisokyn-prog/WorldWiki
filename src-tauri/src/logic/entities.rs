use crate::logic::models::{Entity, EntityRel, EntitySchema, RelationSchema};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// HELPERS
// =====================================================

fn flatten_thing(val: &mut Value) {
    if let Some(obj) = val.as_object_mut() {
        for v in obj.values_mut() {
            if v.is_object() {
                let is_thing = v.get("tb").is_some() && v.get("id").is_some();
                if is_thing {
                    let tb = v["tb"].as_str().unwrap_or("").to_string();
                    let id_field = &v["id"];
                    let id_str = id_field
                        .get("String")
                        .and_then(|s| s.as_str())
                        .or_else(|| id_field.as_str())
                        .unwrap_or("")
                        .to_string();
                    if !tb.is_empty() && !id_str.is_empty() {
                        *v = Value::String(format!("{}:{}", tb, id_str));
                    }
                }
            }
        }
    }
}

fn deserialize_list<T: serde::de::DeserializeOwned>(values: Vec<Value>) -> Vec<T> {
    values
        .into_iter()
        .map(|mut v| {
            flatten_thing(&mut v);
            v
        })
        .filter_map(|v| match serde_json::from_value::<T>(v.clone()) {
            Ok(e) => Some(e),
            Err(e) => {
                eprintln!("⚠️ deserialize error: {}", e);
                None
            }
        })
        .collect()
}

pub fn safe_pid(p: &str) -> String {
    let p = p.trim().replace("projects:", "");
    if p.is_empty() || p == "undefined" {
        "projects:default".to_string()
    } else {
        format!("projects:{}", p)
    }
}

pub fn safe_id(tb: &str, id: &str) -> String {
    let id = id.trim();
    if id.is_empty() || id == "undefined" {
        format!("{}:default", tb)
    } else if id.starts_with(&format!("{}:", tb)) {
        id.to_string()
    } else {
        format!("{}:{}", tb, id)
    }
}

// =====================================================
// ENTITY CRUD
// =====================================================

#[tauri::command]
pub async fn get_entities(
    project: String,
    entity_type: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Entity>, String> {
    get_entities_inner(&state.db, &project, entity_type).await
}

pub async fn get_entities_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, String> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let query = match &entity_type {
        Some(_et) => format!(
            "SELECT * FROM entities WHERE (project_id = '{}' OR project_id = {}) AND entity_type = $et", pid_val, pid_literal
        ),
        None => format!(
            "SELECT * FROM entities WHERE project_id = '{}' OR project_id = {}", pid_val, pid_literal
        ),
    };

    let mut q = db.query(&query);

    if let Some(et) = entity_type {
        q = q.bind(("et", et));
    }

    let mut res = q.await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn get_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Option<Entity>, String> {
    get_entity_inner(&state.db, &id).await
}

pub async fn get_entity_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    id: &str,
) -> Result<Option<Entity>, String> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { id };
    let res: Option<Value> = db
        .select(("entities", actual_id))
        .await
        .map_err(|e| e.to_string())?;

    if let Some(mut val) = res {
        flatten_thing(&mut val);
        match serde_json::from_value(val.clone()) {
            Ok(e) => return Ok(Some(e)),
            Err(e) => {
                println!("[DEBUG get_entity] error: {}", e);
                return Ok(None);
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn save_entity(
    project: String,
    entity: Entity,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Entity, String> {
    save_entity_inner(&state.db, &project, entity).await
}

pub async fn save_entity_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    entity: Entity,
) -> Result<Entity, String> {
    let mut val = serde_json::to_value(&entity).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("updated_at");
        obj.remove("project_id");
    }

    let result: Option<Value> = if let Some(id_str) = &entity.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 {
            parts[1]
        } else {
            id_str.as_str()
        };
        let pid_val = safe_pid(project);
        let pid_raw = pid_val.replace("projects:", "");
        let pid_literal = format!("projects:`{}`", pid_raw);
        let id_val = safe_id("entities", actual_id);
        let mut query = format!(
            "
            UPSERT type::record($id) SET
                project_id = {},
                entity_type = $entity_type,
                name = $name
        ",
            pid_literal
        );

        if entity.description.is_some() {
            query.push_str(", description = $desc");
        }
        if !entity.attributes.is_null() {
            query.push_str(", attributes = $attrs");
        }
        if !entity.tags.is_empty() {
            query.push_str(", tags = $tags");
        }
        if entity.embeddings.is_some() {
            query.push_str(", embeddings = $embeds");
        }

        let mut q = db
            .query(query)
            .bind(("id", id_val))
            .bind(("entity_type", entity.entity_type.clone()))
            .bind(("name", entity.name.clone()));

        if let Some(d) = &entity.description {
            q = q.bind(("desc", d.clone()));
        }
        if !entity.attributes.is_null() {
            q = q.bind(("attrs", entity.attributes.clone()));
        }
        if !entity.tags.is_empty() {
            q = q.bind(("tags", entity.tags.clone()));
        }
        if let Some(e) = &entity.embeddings {
            q = q.bind(("embeds", e.clone()));
        }

        let mut res = q.await.map_err(|e| e.to_string())?;
        let saved: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        saved
    } else {
        let pid_val = safe_pid(project);
        let pid_raw = pid_val.replace("projects:", "");
        let pid_literal = format!("projects:`{}`", pid_raw);
        let mut query = format!(
            "
            CREATE entities SET
                project_id = {},
                entity_type = $entity_type,
                name = $name
        ",
            pid_literal
        );

        if entity.description.is_some() {
            query.push_str(", description = $desc");
        }
        if !entity.attributes.is_null() {
            query.push_str(", attributes = $attrs");
        }
        if !entity.tags.is_empty() {
            query.push_str(", tags = $tags");
        }
        if entity.embeddings.is_some() {
            query.push_str(", embeddings = $embeds");
        }

        let mut q = db
            .query(query)
            .bind(("entity_type", entity.entity_type.clone()))
            .bind(("name", entity.name.clone()));

        if let Some(d) = &entity.description {
            q = q.bind(("desc", d.clone()));
        }
        if !entity.attributes.is_null() {
            q = q.bind(("attrs", entity.attributes.clone()));
        }
        if !entity.tags.is_empty() {
            q = q.bind(("tags", entity.tags.clone()));
        }
        if let Some(e) = &entity.embeddings {
            q = q.bind(("embeds", e.clone()));
        }

        let mut res = q.await.map_err(|e| e.to_string())?;
        let saved: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        saved
    };

    match result {
        Some(mut v) => {
            flatten_thing(&mut v);
            serde_json::from_value(v).map_err(|e| e.to_string())
        }
        None => Err("Entity not saved".to_string()),
    }
}

#[tauri::command]
pub async fn delete_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_inner(&state.db, &id).await
}

pub async fn delete_entity_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    id: &str,
) -> Result<(), String> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        id
    };
    let full_id = safe_id("entities", actual_id);

    let mut tx_res = db
        .query(
            "
        BEGIN TRANSACTION;
        LET $target = type::record($id);
        DELETE entity_rel WHERE in = $target OR out = $target;
        DELETE appears_in WHERE in = $target;
        DELETE entity_revisions WHERE target_id = $target;
        DELETE $target;
        COMMIT TRANSACTION;
    ",
        )
        .bind(("id", full_id))
        .await
        .map_err(|e| e.to_string())?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(format!("Transaction errors: {:?}", errors));
    }

    Ok(())
}

#[tauri::command]
pub async fn search_entities(
    project: String,
    query: String,
    entity_type: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Entity>, String> {
    search_entities_inner(&state.db, &project, &query, entity_type).await
}

pub async fn search_entities_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    query: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, String> {
    let type_filter = if entity_type.is_some() {
        " AND entity_type = $et"
    } else {
        ""
    };

    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let sql = format!(
        "SELECT * FROM entities WHERE (project_id = '{}' OR project_id = {}) \
         AND (name @@ $q OR description @@ $q){} LIMIT 50",
        pid_val, pid_literal, type_filter
    );

    let mut q = db.query(sql).bind(("q", query.to_string()));

    if let Some(et) = entity_type {
        q = q.bind(("et", et));
    }

    let mut res = q.await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

// =====================================================
// ENTITY SCHEMA CRUD
// =====================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaHistoryEntry {
    pub id: Option<String>,
    pub schema_id: String,
    pub project_id: String,
    pub snapshot: serde_json::Value,
    pub saved_at: String,
    pub is_pinned: bool,
    pub commit_msg: Option<String>,
}

#[tauri::command]
pub async fn get_entity_schemas(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EntitySchema>, String> {
    get_entity_schemas_inner(&state.db, &project).await
}

pub async fn get_entity_schemas_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
) -> Result<Vec<EntitySchema>, String> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db
        .query(format!(
            "SELECT * FROM entity_schemas WHERE project_id = '{}' OR project_id = {}",
            pid_val, pid_literal
        ))
        .await
        .map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn save_entity_schema(
    project: String,
    schema: EntitySchema,
    max_saves: Option<usize>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntitySchema, String> {
    save_entity_schema_inner(&state.db, &project, schema, max_saves).await
}

pub async fn save_entity_schema_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    schema: EntitySchema,
    max_saves: Option<usize>,
) -> Result<EntitySchema, String> {
    let proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&schema).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("project_id");
    }

    // FIND EXISTING SCHEMA ID
    let mut res = db
        .query(
            "SELECT id FROM entity_schemas WHERE project_id = $pid AND type_key = $t_key LIMIT 1",
        )
        .bind(("pid", proj_id.clone()))
        .bind(("t_key", schema.type_key.clone()))
        .await
        .map_err(|e| e.to_string())?;

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
        if parts.len() == 2 {
            parts[1].to_string()
        } else {
            id_str.clone()
        }
    } else {
        "".to_string()
    };

    let result: Option<Value> = if !actual_id_str.is_empty() {
        let actual_id = actual_id_str.as_str();
        let safe_actual_id = format!("entity_schemas:`{}`", actual_id);

        // --- BACKUP OLD SCHEMA ---
        let old_res: Option<Value> = db
            .select(("entity_schemas", actual_id))
            .await
            .map_err(|e| e.to_string())?;
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
                .await
                .map_err(|e| e.to_string())?;

            let errors = tx_res.take_errors();
            if !errors.is_empty() {
                eprintln!("[ERROR] Transaction failed: {:?}", errors);
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

        let mut res = q.await.map_err(|e| format!("UPSERT schema error: {}", e))?;
        res.take(0).map_err(|e| e.to_string())?
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

        let mut res = q.await.map_err(|e| format!("CREATE schema error: {}", e))?;
        res.take(0).map_err(|e| e.to_string())?
    };

    match result {
        Some(val) => {
            let mut v = if let Value::Array(arr) = val {
                arr.into_iter().next().unwrap_or(Value::Null)
            } else {
                val
            };
            flatten_thing(&mut v);
            serde_json::from_value(v).map_err(|e| e.to_string())
        }
        None => Err("EntitySchema not saved".to_string()),
    }
}

#[tauri::command]
pub async fn delete_entity_schema(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_schema_inner(&state.db, &project, &type_key).await
}

pub async fn delete_entity_schema_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    type_key: &str,
) -> Result<(), String> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let safe_pid = format!("projects:`{}`", pid_raw);

    let mut tx_res = db.query("
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = type::record($pid) AND rel_type IN
            (SELECT rel_key FROM relation_schemas WHERE project_id = type::record($pid) AND (from_types CONTAINS $type_key OR to_types CONTAINS $type_key));
        DELETE entities WHERE project_id = type::record($pid) AND entity_type = $type_key;
        DELETE entity_schemas WHERE project_id = type::record($pid) AND type_key = $type_key;
        COMMIT TRANSACTION;
    ")
    .bind(("pid", safe_pid))
    .bind(("type_key", type_key.to_string()))
    .await.map_err(|e| e.to_string())?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(format!("Transaction errors: {:?}", errors));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_schema_history(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<SchemaHistoryEntry>, String> {
    get_schema_history_inner(&state.db, &project, &type_key).await
}

pub async fn get_schema_history_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    type_key: &str,
) -> Result<Vec<SchemaHistoryEntry>, String> {
    let pid = format!("projects:{}", project);
    let mut res = db.query("SELECT * FROM schema_history WHERE project_id = type::record($pid) AND type_key = $tk ORDER BY saved_at DESC")
        .bind(("pid", pid))
        .bind(("tk", type_key.to_string()))
        .await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn toggle_schema_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    toggle_schema_history_pin_inner(&state.db, &history_id, is_pinned).await
}

pub async fn toggle_schema_history_pin_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), String> {
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        history_id
    };

    let id_val = safe_id("schema_history", actual_id);
    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", id_val))
        .bind(("is_pinned", is_pinned))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =====================================================
// ENTITY REL CRUD
// =====================================================

#[tauri::command]
pub async fn get_entity_relations(
    project: String,
    entity_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EntityRel>, String> {
    get_entity_relations_inner(&state.db, &project, entity_id).await
}

pub async fn get_entity_relations_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    entity_id: Option<String>,
) -> Result<Vec<EntityRel>, String> {
    let pid_val = safe_pid(project);
    let id_val = match &entity_id {
        Some(e) => safe_id("entities", e),
        None => "".to_string(),
    };
    let sql = match &entity_id {
        Some(_) => "SELECT * FROM entity_rel WHERE (project_id = type::record($pid) OR project_id = $pid) AND (in = type::record($eid) OR out = type::record($eid))",
        None => "SELECT * FROM entity_rel WHERE project_id = type::record($pid) OR project_id = $pid",
    };

    let mut q = db.query(sql).bind(("pid", pid_val));

    if entity_id.is_some() {
        q = q.bind(("eid", id_val));
    }

    let mut res = q.await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn create_entity_relation(
    project: String,
    from_id: String,
    to_id: String,
    rel: EntityRel,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntityRel, String> {
    create_entity_relation_inner(&state.db, &project, &from_id, &to_id, rel).await
}

pub async fn create_entity_relation_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    from_id: &str,
    to_id: &str,
    rel: EntityRel,
) -> Result<EntityRel, String> {
    let proj_id = format!("projects:{}", project);

    fn make_record(table: &str, full_id: &str) -> surrealdb::types::RecordId {
        let raw = full_id.split(':').nth(1).unwrap_or(full_id);
        surrealdb::types::RecordId::new(table, raw)
    }

    let from_rec = make_record("entities", from_id);
    let to_rec = make_record("entities", to_id);

    let mut query = "
        RELATE $from -> entity_rel -> $to SET
            project_id = type::record($pid),
            rel_type = $rel_type
    "
    .to_string();

    if rel.description.is_some() {
        query.push_str(", description = $desc");
    }
    if rel.strength.is_some() {
        query.push_str(", strength = $strength");
    }
    if !rel.attributes.is_null() {
        query.push_str(", attributes = $attrs");
    }
    if let Some(ref sc) = rel.start_chapter {
        if !sc.is_empty() {
            query.push_str(", start_chapter = type::record($start_chapter)");
        }
    }
    if let Some(ref ec) = rel.end_chapter {
        if !ec.is_empty() {
            query.push_str(", end_chapter = type::record($end_chapter)");
        }
    }
    query.push_str(" RETURN AFTER");

    let mut q = db
        .query(query)
        .bind(("from", from_rec))
        .bind(("to", to_rec))
        .bind(("pid", proj_id))
        .bind(("rel_type", rel.rel_type.clone()));

    if let Some(ref d) = rel.description {
        q = q.bind(("desc", d.clone()));
    }
    if let Some(s) = rel.strength {
        q = q.bind(("strength", s));
    }
    if !rel.attributes.is_null() {
        q = q.bind(("attrs", rel.attributes.clone()));
    }
    if let Some(ref sc) = rel.start_chapter {
        if !sc.is_empty() {
            q = q.bind(("start_chapter", sc.clone()));
        }
    }
    if let Some(ref ec) = rel.end_chapter {
        if !ec.is_empty() {
            q = q.bind(("end_chapter", ec.clone()));
        }
    }

    let mut res = q.await.map_err(|e| e.to_string())?;
    let created: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
    match created {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string()),
        None => Err("EntityRel not created".to_string()),
    }
}

#[tauri::command]
pub async fn delete_entity_relation(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_relation_inner(&state.db, &id).await
}

pub async fn delete_entity_relation_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    id: &str,
) -> Result<(), String> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { id };
    let _: Option<Value> = db
        .delete(("entity_rel", actual_id))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =====================================================
// RELATION SCHEMA CRUD
// =====================================================

#[tauri::command]
pub async fn get_relation_schemas(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<RelationSchema>, String> {
    get_relation_schemas_inner(&state.db, &project).await
}

pub async fn get_relation_schemas_inner(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
) -> Result<Vec<RelationSchema>, String> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db
        .query(format!(
            "SELECT * FROM relation_schemas WHERE project_id = '{}' OR project_id = {}",
            pid_val, pid_literal
        ))
        .await
        .map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn save_relation_schema(
    project: String,
    schema: RelationSchema,
    state: tauri::State<'_, crate::AppState>,
) -> Result<RelationSchema, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    let mut val = serde_json::to_value(&schema).map_err(|e| e.to_string())?;
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
            .await
            .map_err(|e| e.to_string())?
    } else {
        db.create("relation_schemas")
            .content(val)
            .await
            .map_err(|e| e.to_string())?
    };

    match result {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string()),
        None => Err("RelationSchema not saved".to_string()),
    }
}

#[tauri::command]
pub async fn delete_relation_schema(
    project: String,
    rel_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    db.query(
        "
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = $pid AND rel_type = $rel_key;
        DELETE relation_schemas WHERE project_id = $pid AND rel_key = $rel_key;
        COMMIT TRANSACTION;
    ",
    )
    .bind(("pid", proj_id))
    .bind(("rel_key", rel_key))
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_entity_revisions(
    project: String,
    entity_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, String> {
    let db = &state.db;
    let _proj_id = format!("projects:{}", project);

    let parts: Vec<&str> = entity_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        entity_id.as_str()
    };
    let full_id = format!("entities:⟨{}⟩", actual_id);

    let mut result = db.query(
        "SELECT * FROM entity_revisions WHERE target_id = type::record($target_id) ORDER BY created_at DESC"
    )
    .bind(("target_id", full_id))
    .await
    .map_err(|e| e.to_string())?;

    let revisions: Vec<Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(revisions)
}

#[tauri::command]
pub async fn toggle_entity_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    toggle_entity_history_pin_inner(db, &history_id, is_pinned).await
}

/// Тестируемое ядро `toggle_entity_history_pin` (без `tauri::State`).
pub async fn toggle_entity_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), String> {
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        history_id
    };

    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("entity_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn safe_pid_normalizes() {
        assert_eq!(safe_pid("proj1"), "projects:proj1");
        assert_eq!(safe_pid("projects:proj1"), "projects:proj1");
        assert_eq!(safe_pid("  proj1  "), "projects:proj1");
    }

    #[test]
    fn safe_pid_falls_back_to_default() {
        assert_eq!(safe_pid(""), "projects:default");
        assert_eq!(safe_pid("undefined"), "projects:default");
        assert_eq!(safe_pid("projects:"), "projects:default");
    }

    #[test]
    fn safe_id_adds_table_prefix() {
        assert_eq!(safe_id("entities", "abc"), "entities:abc");
        assert_eq!(safe_id("entities", "entities:abc"), "entities:abc");
        assert_eq!(safe_id("entities", "  abc  "), "entities:abc");
    }

    #[test]
    fn safe_id_falls_back_to_default() {
        assert_eq!(safe_id("entities", ""), "entities:default");
        assert_eq!(safe_id("entities", "undefined"), "entities:default");
        // "entities:" starts with the prefix, so it's returned as-is (not default).
        assert_eq!(safe_id("entities", "entities:"), "entities:");
    }

    #[test]
    fn flatten_thing_converts_record_to_string() {
        let mut val = json!({
            "key": { "tb": "entities", "id": { "String": "e1" } }
        });
        flatten_thing(&mut val);
        assert_eq!(val["key"], json!("entities:e1"));
    }

    #[test]
    fn flatten_thing_plain_id_string() {
        let mut val = json!({
            "key": { "tb": "entities", "id": "e2" }
        });
        flatten_thing(&mut val);
        assert_eq!(val["key"], json!("entities:e2"));
    }

    #[test]
    fn flatten_thing_does_not_touch_non_thing_objects() {
        let mut val = json!({ "key": { "hello": "world" } });
        flatten_thing(&mut val);
        assert_eq!(val["key"]["hello"], "world");
    }

    #[test]
    fn flatten_thing_skips_non_string_id() {
        let mut val = json!({ "key": { "tb": "entities", "id": { "Object": "x" } } });
        flatten_thing(&mut val);
        assert!(val["key"]["tb"] == "entities");
    }
}
