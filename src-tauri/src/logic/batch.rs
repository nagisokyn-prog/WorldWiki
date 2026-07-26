use serde_json::{Value, Map};
use crate::logic::models::{Entity, EntityRel};

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
        .filter_map(|v| serde_json::from_value::<T>(v).ok())
        .collect()
}

#[tauri::command]
pub async fn get_entities_batch(
    project: String,
    entity_types: Vec<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Map<String, Value>, String> {
    let db = &state.db;
    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    
    let mut result_map = Map::new();
    
    if entity_types.is_empty() {
        return Ok(result_map);
    }
    
    let query = format!(
        "SELECT * FROM entities WHERE (project_id = '{}' OR project_id = {}) AND entity_type IN $types",
        pid_val, pid_literal
    );
    
    let mut res = db.query(&query)
        .bind(("types", entity_types.clone()))
        .await
        .map_err(|e| e.to_string())?;
        
    let values: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    let entities: Vec<Entity> = deserialize_list(values);
    
    for entity_type in entity_types {
        result_map.insert(entity_type.clone(), Value::Array(Vec::new()));
    }
    
    for entity in entities {
        let etype = entity.entity_type.clone();
        if let Some(Value::Array(arr)) = result_map.get_mut(&etype) {
            if let Ok(val) = serde_json::to_value(entity) {
                arr.push(val);
            }
        }
    }
    
    Ok(result_map)
}

#[tauri::command]
pub async fn upsert_connections_batch(
    project: String,
    _source_type: String,
    source_id: String,
    connections: Vec<EntityRel>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let from_full = if source_id.contains(':') { source_id.clone() } else { format!("entities:{}", source_id) };

    let mut query = String::from("BEGIN TRANSACTION;\n");
    
    // Сначала удаляем все связи, связанные с этим источником (входящие и исходящие)
    query.push_str(&format!(
        "DELETE entity_rel WHERE project_id = $pid AND (in = type::record('{0}') OR out = type::record('{0}'));\n",
        from_full
    ));

    let mut bind_data = Map::new();
    bind_data.insert("pid".to_string(), Value::String(proj_id.clone()));

    // Добавляем новые связи
    for (i, rel) in connections.into_iter().enumerate() {
        let target_id = rel.out.clone().unwrap_or_default();
        if target_id.is_empty() { continue; }
        
        let to_full = if target_id.contains(':') { target_id } else { format!("entities:{}", target_id) };
        let source_for_this_rel = rel.r#in.clone().unwrap_or_else(|| source_id.clone());
        let from_for_this_rel = if source_for_this_rel.contains(':') { source_for_this_rel } else { format!("entities:{}", source_for_this_rel) };
        
        let mut rel_val = serde_json::to_value(&rel).unwrap_or(Value::Null);
        if let Some(obj) = rel_val.as_object_mut() {
            obj.remove("id"); obj.remove("in"); obj.remove("out");
            obj.remove("created_at");
            obj.insert("project_id".into(), Value::String(proj_id.clone()));
        }
        
        let var_name = format!("data_{}", i);
        bind_data.insert(var_name.clone(), rel_val);
        
        query.push_str(&format!(
            "RELATE type::record('{}') -> entity_rel -> type::record('{}') CONTENT ${};\n",
            from_for_this_rel, to_full, var_name
        ));
    }
    
    query.push_str("COMMIT TRANSACTION;\n");
    
    let mut q = db.query(query);
    for (k, v) in bind_data {
        q = q.bind((k.as_str(), v));
    }
    
    let mut res = q.await.map_err(|e| e.to_string())?;
    
    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(format!("Transaction errors: {:?}", errors));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn save_entity_with_relations(
    project: String,
    entity: Entity,
    foreign_updates: Vec<Entity>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Entity, String> {
    let db = &state.db;
    
    let mut val = serde_json::to_value(&entity).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id"); obj.remove("created_at"); obj.remove("updated_at"); obj.remove("project_id");
    }

    let _is_create = entity.id.is_none();
    
    let pid_val = safe_pid(&project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    
    let mut query = String::from("BEGIN TRANSACTION;\n");
    let mut bind_data = Map::new();
    
    let main_entity_id = if let Some(id_str) = &entity.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        safe_id("entities", actual_id)
    } else {
        // Если это создание новой сущности, генерируем временный ID на основе timestamp
        let new_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis().to_string();
        format!("entities:{}", new_id)
    };
    
    bind_data.insert("main_id".to_string(), Value::String(main_entity_id.clone()));
    bind_data.insert("main_data".to_string(), val.clone());
    bind_data.insert("entity_type".to_string(), Value::String(entity.entity_type.clone()));
    bind_data.insert("name".to_string(), Value::String(entity.name.clone()));
    
    if let Some(d) = &entity.description { bind_data.insert("desc".to_string(), Value::String(d.clone())); }
    if !entity.attributes.is_null() { bind_data.insert("attrs".to_string(), entity.attributes.clone()); }
    if !entity.tags.is_empty() { 
        if let Ok(tv) = serde_json::to_value(&entity.tags) { bind_data.insert("tags".to_string(), tv); }
    }
    if let Some(e) = &entity.embeddings { bind_data.insert("embeds".to_string(), e.clone()); }
    
    let set_fields = "project_id = {}, entity_type = $entity_type, name = $name \
        {desc} {attrs} {tags} {embeds}";
        
    let desc_str = if entity.description.is_some() { ", description = $desc" } else { "" };
    let attrs_str = if !entity.attributes.is_null() { ", attributes = $attrs" } else { "" };
    let tags_str = if !entity.tags.is_empty() { ", tags = $tags" } else { "" };
    let embeds_str = if entity.embeddings.is_some() { ", embeddings = $embeds" } else { "" };
    
    let set_clause = set_fields
        .replace("{}", &pid_literal)
        .replace("{desc}", desc_str)
        .replace("{attrs}", attrs_str)
        .replace("{tags}", tags_str)
        .replace("{embeds}", embeds_str);
    
    // В зависимости от того, есть ли ID, делаем CREATE или UPSERT.
    // Поскольку мы сгенерировали ID выше для CREATE, мы можем использовать UPSERT в обоих случаях (или UPDATE).
    // Поведение Surreal: UPSERT создаст если нет.
    query.push_str(&format!("LET $saved = (UPSERT type::record($main_id) SET {});\n", set_clause));
    
    let num_foreign_updates = foreign_updates.len();
    
    // Добавляем foreign updates
    for (i, foreign) in foreign_updates.into_iter().enumerate() {
        if let Some(ref fid) = foreign.id {
            let fparts: Vec<&str> = fid.splitn(2, ':').collect();
            let factual_id = if fparts.len() == 2 { fparts[1] } else { fid.as_str() };
            let foreign_full_id = safe_id("entities", factual_id);
            
            let mut fval = serde_json::to_value(&foreign).unwrap_or(Value::Null);
            if let Some(obj) = fval.as_object_mut() {
                obj.remove("id"); obj.remove("created_at"); obj.remove("updated_at"); obj.remove("project_id");
            }
            
            let var_name = format!("foreign_data_{}", i);
            let id_var = format!("foreign_id_{}", i);
            
            bind_data.insert(id_var.clone(), Value::String(foreign_full_id));
            
            bind_data.insert(format!("{}_et", var_name), Value::String(foreign.entity_type.clone()));
            bind_data.insert(format!("{}_name", var_name), Value::String(foreign.name.clone()));
            
            let mut f_set = format!("project_id = {}, entity_type = ${}_et, name = ${}_name", pid_literal, var_name, var_name);
            
            if let Some(d) = &foreign.description { 
                bind_data.insert(format!("{}_desc", var_name), Value::String(d.clone())); 
                f_set.push_str(&format!(", description = ${}_desc", var_name));
            }
            if !foreign.attributes.is_null() { 
                bind_data.insert(format!("{}_attrs", var_name), foreign.attributes.clone()); 
                f_set.push_str(&format!(", attributes = ${}_attrs", var_name));
            }
            if !foreign.tags.is_empty() { 
                if let Ok(tv) = serde_json::to_value(&foreign.tags) { 
                    bind_data.insert(format!("{}_tags", var_name), tv); 
                    f_set.push_str(&format!(", tags = ${}_tags", var_name));
                }
            }
            if let Some(e) = &foreign.embeddings { 
                bind_data.insert(format!("{}_embeds", var_name), e.clone()); 
                f_set.push_str(&format!(", embeddings = ${}_embeds", var_name));
            }

            query.push_str(&format!("UPSERT type::record(${id_var}) SET {};\n", f_set));
        }
    }
    
    query.push_str("COMMIT TRANSACTION;\nRETURN $saved;\n");
    
    let mut q = db.query(query);
    for (k, v) in bind_data {
        q = q.bind((k.as_str(), v));
    }
    
    let mut res = q.await.map_err(|e| e.to_string())?;
    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(format!("Transaction errors: {:?}", errors));
    }
    
    // Возвращаем сохраненную основную сущность (из RETURN $saved)
    // res.take(0) вернет результат LET $saved, мы возвращаем последний стейтмент RETURN
    // Транзакция в surrealdb возвращает массив результатов для каждого стейтмента.
    // Нам нужно найти последний результат
    let num_statements = num_foreign_updates + 4; // BEGIN, LET, UPSERTs..., COMMIT, RETURN
    let saved_val: Option<Value> = res.take(num_statements - 1).map_err(|e| e.to_string())?; // RETURN statement
    
    if let Some(val) = saved_val {
        let mut v = if let Value::Array(arr) = val {
            if let Some(first) = arr.into_iter().next() {
                first
            } else {
                return Err("Failed to retrieve saved entity (empty array)".to_string());
            }
        } else {
            val
        };
        flatten_thing(&mut v);
        return serde_json::from_value(v).map_err(|e| e.to_string());
    }

    Err("Failed to retrieve saved entity from transaction".to_string())
}
