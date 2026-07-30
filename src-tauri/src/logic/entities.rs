use serde_json::Value;
use serde::{Serialize, Deserialize};
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

fn safe_pid(p: &str) -> String {
    let p = p.trim().replace("projects:", "");
    if p.is_empty() || p == "undefined" {
        "projects:default".to_string()
    } else {
        format!("projects:{}", p)
    }
}

fn safe_id(tb: &str, id: &str) -> String {
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
    let db = &state.db;
    let pid_val = safe_pid(&project);
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

    let debug_q = db.query("SELECT id, project_id FROM entities");
    if let Ok(mut debug_res) = debug_q.await {
        if let Ok(debug_vals) = debug_res.take::<Vec<Value>>(0) {
            println!("[DEBUG] All entities in DB: {}", serde_json::to_string_pretty(&debug_vals).unwrap_or_default());
        }
    }

    println!("[DEBUG get_entities] project='{}' pid_val='{}' pid_literal='{}' query={}", project, pid_val, pid_literal, query);

    let mut res = q.await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    println!("[DEBUG get_entities] returned {} items", values.len());
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
    let db = &state.db;
    let _proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&entity).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("updated_at");
        obj.remove("project_id");
    }

    let result: Option<Value> = if let Some(id_str) = &entity.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        let pid_val = safe_pid(&project);
        let pid_raw = pid_val.replace("projects:", "");
        let pid_literal = format!("projects:`{}`", pid_raw);
        let id_val = safe_id("entities", actual_id);
        let mut query = format!("
            UPSERT type::record($id) SET
                project_id = {},
                entity_type = $entity_type,
                name = $name
        ", pid_literal);
        
        if entity.description.is_some() { query.push_str(", description = $desc"); }
        if !entity.attributes.is_null() { query.push_str(", attributes = $attrs"); }
        if !entity.tags.is_empty() { query.push_str(", tags = $tags"); }
        if entity.embeddings.is_some() { query.push_str(", embeddings = $embeds"); }

        println!("[DEBUG save_entity] UPSERT query: {}", query);

        let mut q = db.query(query)
            .bind(("id", id_val))
            .bind(("entity_type", entity.entity_type.clone()))
            .bind(("name", entity.name.clone()));
            
        if let Some(d) = &entity.description { q = q.bind(("desc", d.clone())); }
        if !entity.attributes.is_null() { q = q.bind(("attrs", entity.attributes.clone())); }
        if !entity.tags.is_empty() { q = q.bind(("tags", entity.tags.clone())); }
        if let Some(e) = &entity.embeddings { q = q.bind(("embeds", e.clone())); }

        let mut res = q.await.map_err(|e| e.to_string())?;
        let saved: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        println!("[DEBUG save_entity] saved result: {:?}", saved);

        // DEBUG: check all entities in DB after save
        let debug_q = db.query("SELECT * FROM entities");
        if let Ok(mut debug_res) = debug_q.await {
            if let Ok(debug_vals) = debug_res.take::<Vec<Value>>(0) {
                println!("[DEBUG save_entity] All entities in DB after save: {}", serde_json::to_string_pretty(&debug_vals).unwrap_or_default());
            }
        }
        
        saved
    } else {
        let pid_val = safe_pid(&project);
        let pid_raw = pid_val.replace("projects:", "");
        let pid_literal = format!("projects:`{}`", pid_raw);
        let mut query = format!("
            CREATE entities SET
                project_id = {},
                entity_type = $entity_type,
                name = $name
        ", pid_literal);

        if entity.description.is_some() { query.push_str(", description = $desc"); }
        if !entity.attributes.is_null() { query.push_str(", attributes = $attrs"); }
        if !entity.tags.is_empty() { query.push_str(", tags = $tags"); }
        if entity.embeddings.is_some() { query.push_str(", embeddings = $embeds"); }

        println!("[DEBUG save_entity] CREATE query: {}", query);

        let mut q = db.query(query)
            .bind(("entity_type", entity.entity_type.clone()))
            .bind(("name", entity.name.clone()));
            
        if let Some(d) = &entity.description { q = q.bind(("desc", d.clone())); }
        if !entity.attributes.is_null() { q = q.bind(("attrs", entity.attributes.clone())); }
        if !entity.tags.is_empty() { q = q.bind(("tags", entity.tags.clone())); }
        if let Some(e) = &entity.embeddings { q = q.bind(("embeds", e.clone())); }

        let mut res = q.await.map_err(|e| e.to_string())?;
        let saved: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
        println!("[DEBUG save_entity] saved result: {:?}", saved);

        // DEBUG: check all entities in DB after save
        let debug_q = db.query("SELECT * FROM entities");
        if let Ok(mut debug_res) = debug_q.await {
            if let Ok(debug_vals) = debug_res.take::<Vec<Value>>(0) {
                println!("[DEBUG save_entity] All entities in DB after create: {}", serde_json::to_string_pretty(&debug_vals).unwrap_or_default());
            }
        }
        
        saved
    };

    match result {
        Some(mut v) => {
            flatten_thing(&mut v);
            serde_json::from_value(v).map_err(|e| e.to_string())
        },
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
    let full_id = format!("entities:{}", actual_id);

    db.query("
        BEGIN TRANSACTION;
        DELETE entity_rel WHERE in = type::record($id) OR out = type::record($id);
        DELETE appears_in WHERE in = type::record($id);
        DELETE entity_revisions WHERE target_id = type::record($id);
        DELETE type::record($id);
        COMMIT TRANSACTION;
    ")
    .bind(("id", full_id))
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

    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let sql = format!(
        "SELECT * FROM entities WHERE (project_id = '{}' OR project_id = {}) \
         AND (name @@ $q OR description @@ $q){} LIMIT 50",
        pid_val, pid_literal, type_filter
    );

    let mut q = db.query(sql)
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
    let db = &state.db;
    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db.query(format!("SELECT * FROM entity_schemas WHERE project_id = '{}' OR project_id = {}", pid_val, pid_literal))
        .await.map_err(|e| e.to_string())?;
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    println!("[DEBUG get_entity_schemas] project='{}' pid_val='{}' pid_literal='{}' found {} schemas", project, pid_val, pid_literal, values.len());
    Ok(deserialize_list(values))
}

#[tauri::command]
pub async fn save_entity_schema(
    project: String,
    schema: EntitySchema,
    max_saves: Option<usize>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntitySchema, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);

    let mut val = serde_json::to_value(&schema).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id");
        obj.remove("created_at");
        obj.remove("project_id");
    }

    // FIND EXISTING SCHEMA ID
    let mut res = db.query("SELECT id FROM entity_schemas WHERE project_id = $pid AND type_key = $t_key LIMIT 1")
        .bind(("pid", proj_id.clone()))
        .bind(("t_key", schema.type_key.clone()))
        .await.map_err(|e| e.to_string())?;
    
    let mut existing_records: Vec<Value> = res.take(0).unwrap_or_default();
    
    // Flatten the Thing ID objects so we get plain "table:id" strings
    for rec in existing_records.iter_mut() {
        flatten_thing(rec);
    }
    
    eprintln!("[DEBUG] schema lookup result for '{}': {:?}", schema.type_key, existing_records);
    
    let actual_id_str = if let Some(first) = existing_records.first() {
        // After flatten_thing, id field should be "entity_schemas:xxxx"
        if let Some(id_val) = first.get("id") {
            let id_string = id_val.as_str().unwrap_or("");
            eprintln!("[DEBUG] found schema id_string: '{}'", id_string);
            let parts: Vec<&str> = id_string.splitn(2, ':').collect();
            if parts.len() == 2 { parts[1].to_string() } else { id_string.to_string() }
        } else {
            "".to_string()
        }
    } else if let Some(id_str) = &schema.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        if parts.len() == 2 { parts[1].to_string() } else { id_str.clone() }
    } else {
        "".to_string()
    };
    
    eprintln!("[DEBUG] actual_id_str: '{}'", actual_id_str);

    let result: Option<Value> = if !actual_id_str.is_empty() {
        let actual_id = actual_id_str.as_str();
        let safe_actual_id = format!("entity_schemas:`{}`", actual_id);
        
        // --- BACKUP OLD SCHEMA ---
        let old_res: Option<Value> = db.select(("entity_schemas", actual_id)).await.map_err(|e| e.to_string())?;
        if let Some(old_schema_val) = old_res {
            let mut snap = serde_json::Map::new();
            snap.insert("schema_id".into(), Value::String(safe_actual_id.clone()));
            snap.insert("type_key".into(), Value::String(schema.type_key.clone()));
            snap.insert("project_id".into(), Value::String(proj_id.clone()));
            snap.insert("snapshot".into(), old_schema_val);
            snap.insert("saved_at".into(), Value::String(chrono::Utc::now().to_rfc3339()));
            snap.insert("is_pinned".into(), Value::Bool(false));
            let max_limit = max_saves.unwrap_or(30);
            
            let query_str = "
                BEGIN TRANSACTION;
                
                CREATE schema_history CONTENT $snap;
                
                LET $target = type::record($id);
                LET $unpinned = (SELECT id, saved_at FROM schema_history WHERE schema_id = $target AND is_pinned = false ORDER BY saved_at DESC);
                IF (array::len($unpinned) > $max_limit) {
                    LET $to_delete = array::slice($unpinned, $max_limit, array::len($unpinned));
                    DELETE $to_delete;
                };
                
                COMMIT TRANSACTION;
            ";

            let mut tx_res = db.query(query_str)
                .bind(("snap", Value::Object(snap)))
                .bind(("id", safe_actual_id.clone()))
                .bind(("max_limit", max_limit))
                .await.map_err(|e| e.to_string())?;
                
            let errors = tx_res.take_errors();
            if !errors.is_empty() {
                eprintln!("[ERROR] Transaction failed: {:?}", errors);
            }
        }
        // -------------------------

        let pid_val = safe_pid(&project);
        let pid_raw = pid_val.replace("projects:", "");
        let safe_pid = format!("projects:`{}`", pid_raw);
        let query = format!("
            UPSERT type::record($id) SET 
                project_id = type::record($pid),
                type_key = $data.type_key,
                type_name = $data.type_name,
                icon = $data.icon,
                color = $data.color,
                fields_schema = $data.fields_schema,
                full_schema = $data.full_schema
        ");
        let mut res = db.query(query)
            .bind(("id", safe_actual_id.clone()))
            .bind(("pid", safe_pid.clone()))
            .bind(("data", val.clone()))
            .await.map_err(|e| format!("UPSERT schema error: {}", e))?;
        res.take(0).map_err(|e| e.to_string())?
    } else {
        let pid_val = safe_pid(&project);
        let pid_raw = pid_val.replace("projects:", "");
        let safe_pid = format!("projects:`{}`", pid_raw);
        // Explicitly generate an ID instead of letting SurrealDB auto-generate it.
        // This avoids any weird bugs with CREATE.
        let new_id = format!("entity_schemas:`{}_{}`", pid_raw, schema.type_key);
        let query = format!("
            CREATE type::record($id) SET 
                project_id = type::record($pid),
                type_key = $data.type_key,
                type_name = $data.type_name,
                icon = $data.icon,
                color = $data.color,
                fields_schema = $data.fields_schema,
                full_schema = $data.full_schema
        ");
        let mut res = db.query(query)
            .bind(("id", new_id))
            .bind(("pid", safe_pid))
            .bind(("data", val.clone()))
            .await.map_err(|e| format!("CREATE schema error: {}", e))?;
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
        },
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

#[tauri::command]
pub async fn get_schema_history(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<SchemaHistoryEntry>, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    let mut res = db.query("SELECT * FROM schema_history WHERE project_id = $pid AND type_key = $tk ORDER BY saved_at DESC")
        .bind(("pid", proj_id))
        .bind(("tk", type_key))
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
    let db = &state.db;
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { history_id.as_str() };
    
    let id_val = safe_id("schema_history", actual_id);
    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", id_val))
        .bind(("is_pinned", is_pinned))
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
    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let id_val = match &entity_id {
        Some(e) => safe_id("entities", e),
        None => "".to_string(),
    };
    let sql = match &entity_id {
        Some(_) => format!("SELECT * FROM entity_rel WHERE project_id = '{}' AND (in = type::record($eid) OR out = type::record($eid))", pid_literal),
        None => format!("SELECT * FROM entity_rel WHERE project_id = '{}'", pid_literal),
    };

    let mut q = db.query(sql);

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
    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut res = db.query(format!("SELECT * FROM relation_schemas WHERE project_id = '{}' OR project_id = {}", pid_val, pid_literal))
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

#[tauri::command]
pub async fn get_entity_revisions(
    project: String,
    entity_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let mut result = db.query(
        "SELECT * FROM entity_revisions WHERE target_id = type::record($target_id) AND project_id = $project_id ORDER BY created_at DESC"
    )
    .bind(("target_id", entity_id))
    .bind(("project_id", proj_id))
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
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { &history_id };
    
    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("entity_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(())
}