use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use serde_json::Value;
use crate::logic::models::{Entity, EntitySchema, EntityRel, RelationSchema};

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
                        .get("String").and_then(|s| s.as_str())
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
    values.into_iter()
        .map(|mut v| { flatten_thing(&mut v); v })
        .filter_map(|v| match serde_json::from_value::<T>(v.clone()) {
            Ok(e) => Some(e),
            Err(e) => { eprintln!("⚠️ deserialize error: {}", e); None }
        })
        .collect()
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
    let db = &state.db;
    let query = match &entity_type {
        Some(_et) => format!(
            "SELECT * FROM entities WHERE (project_id = $pid OR project_id = type::record('projects', $pid_raw)) AND entity_type = $et"
        ),
        None => format!(
            "SELECT * FROM entities WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw)"
        ),
    };

    let mut q = db.query(&query)
        .bind(("pid", format!("projects:{}", project)))
        .bind(("pid_raw", project.clone()));

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
    let db = &state.db;
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { &id };
    let res: Option<Value> = db.select(("entities", actual_id))
        .await.map_err(|e| e.to_string())?;
    Ok(res.and_then(|v| serde_json::from_value(v).ok()))
}

#[tauri::command]
pub async fn save_entity(
    project: String,
    entity: Entity,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Entity, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&entity).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("updated_at");
        obj.insert("project_id".into(), Value::String(proj_id.clone()));
    }

    let result: Option<Value> = if let Some(id_str) = &entity.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        db.upsert(("entities", actual_id))
            .content(val)
            .await.map_err(|e| e.to_string())?
    } else {
        db.create("entities")
            .content(val)
            .await.map_err(|e| e.to_string())?
    };

    match result {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string()),
        None => Err("Entity not saved".to_string()),
    }
}

#[tauri::command]
pub async fn delete_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { &id };

    db.query("DELETE entity_rel WHERE in = type::record($id) OR out = type::record($id)")
        .bind(("id", format!("entities:{}", actual_id)))
        .await.map_err(|e| e.to_string())?;

    let _: Option<Value> = db.delete(("entities", actual_id))
        .await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn search_entities(
    project: String,
    query: String,
    entity_type: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Entity>, String> {
    let db = &state.db;
    let type_filter = if entity_type.is_some() {
        " AND entity_type = $et"
    } else { "" };

    let sql = format!(
        "SELECT * FROM entities WHERE (project_id = $pid OR project_id = type::record('projects', $pid_raw)) \
         AND (name @@ $q OR description @@ $q){} LIMIT 50",
        type_filter
    );

    let mut q = db.query(sql)
        .bind(("pid", format!("projects:{}", project)))
        .bind(("pid_raw", project.clone()))
        .bind(("q", query));

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

#[tauri::command]
pub async fn get_entity_schemas(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EntitySchema>, String> {
    let db = &state.db;
    let mut res = db.query("SELECT * FROM entity_schemas WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw)")
        .bind(("pid", format!("projects:{}", project)))
        .bind(("pid_raw", project))
        .await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn save_entity_schema(
    project: String,
    schema: EntitySchema,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntitySchema, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&schema).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.insert("project_id".into(), Value::String(proj_id));
    }

    let result: Option<Value> = if let Some(id_str) = &schema.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        db.upsert(("entity_schemas", actual_id))
            .merge(val)
            .await.map_err(|e| e.to_string())?
    } else {
        db.create("entity_schemas")
            .content(val)
            .await.map_err(|e| e.to_string())?
    };

    match result {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string()),
        None => Err("EntitySchema not saved".to_string()),
    }
}

#[tauri::command]
pub async fn delete_entity_schema(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);

    db.query("
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = $pid AND rel_type IN
            (SELECT rel_key FROM relation_schemas WHERE project_id = $pid AND (from_types CONTAINS $type_key OR to_types CONTAINS $type_key));
        DELETE entities WHERE project_id = $pid AND entity_type = $type_key;
        DELETE entity_schemas WHERE project_id = $pid AND type_key = $type_key;
        COMMIT TRANSACTION;
    ")
    .bind(("pid", proj_id))
    .bind(("type_key", type_key))
    .await.map_err(|e| e.to_string())?;

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
    let db = &state.db;
    let sql = match &entity_id {
        Some(_) => "SELECT * FROM entity_rel WHERE project_id = $pid AND (in = type::record('entities', $eid_raw) OR out = type::record('entities', $eid_raw))",
        None => "SELECT * FROM entity_rel WHERE project_id = $pid",
    };

    let mut q = db.query(sql)
        .bind(("pid", format!("projects:{}", project)));

    if let Some(eid) = entity_id {
        let actual_id = eid.split(':').last().unwrap_or(&eid);
        q = q.bind(("eid_raw", actual_id.to_string()));
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
    let db = &state.db;
    let proj_id = format!("projects:{}", project);

    let from = if from_id.contains(':') { from_id } else { format!("entities:{}", from_id) };
    let to = if to_id.contains(':') { to_id } else { format!("entities:{}", to_id) };

    let mut data = serde_json::to_value(&rel).map_err(|e| e.to_string())?;
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id"); obj.remove("in"); obj.remove("out");
        obj.remove("created_at");
        obj.insert("project_id".into(), Value::String(proj_id));
    }

    let sql = format!("RELATE {} -> entity_rel -> {} CONTENT $data RETURN AFTER", from, to);
    let mut res = db.query(sql)
        .bind(("data", data))
        .await.map_err(|e| e.to_string())?;

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
    let db = &state.db;
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { &id };
    let _: Option<Value> = db.delete(("entity_rel", actual_id))
        .await.map_err(|e| e.to_string())?;
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
    let db = &state.db;
    let mut res = db.query("SELECT * FROM relation_schemas WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw)")
        .bind(("pid", format!("projects:{}", project)))
        .bind(("pid_raw", project))
        .await.map_err(|e| e.to_string())?;
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
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        db.upsert(("relation_schemas", actual_id))
            .merge(val)
            .await.map_err(|e| e.to_string())?
    } else {
        db.create("relation_schemas")
            .content(val)
            .await.map_err(|e| e.to_string())?
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
    db.query("
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE project_id = $pid AND rel_type = $rel_key;
        DELETE relation_schemas WHERE project_id = $pid AND rel_key = $rel_key;
        COMMIT TRANSACTION;
    ")
    .bind(("pid", proj_id))
    .bind(("rel_key", rel_key))
    .await.map_err(|e| e.to_string())?;
    Ok(())
}