use serde_json::{Value, Map};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use crate::logic::models::{Entity, EntityRel};

// IPC layer extracted (architecture split):
mod commands;
pub use commands::*;

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

pub fn flatten_thing(val: &mut Value) {
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


pub async fn get_entities_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_types: Vec<String>,
) -> Result<Map<String, Value>, String> {
    let pid_val = safe_pid(project);
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


pub async fn upsert_connections_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    _source_type: &str,
    source_id: &str,
    connections: Vec<EntityRel>,
) -> Result<(), String> {
    let proj_id = format!("projects:{}", project.trim().replace("projects:", ""));
    
    let from_full = if source_id.contains(':') { source_id.to_string() } else { format!("entities:{}", source_id) };

    let mut query = String::from("BEGIN TRANSACTION;\n");
    
    query.push_str(&format!(
        "DELETE entity_rel WHERE project_id = type::record($pid) AND (in = type::record('{0}') OR out = type::record('{0}'));\n",
        from_full
    ));

    let mut bind_data = Map::new();
    bind_data.insert("pid".to_string(), Value::String(proj_id.clone()));

    for (i, rel) in connections.into_iter().enumerate() {
        let target_id = rel.out.clone().unwrap_or_default();
        if target_id.is_empty() { continue; }
        
        let to_full = if target_id.contains(':') { target_id } else { format!("entities:{}", target_id) };
        let source_for_this_rel = rel.r#in.clone().unwrap_or_else(|| source_id.to_string());
        let from_for_this_rel = if source_for_this_rel.contains(':') { source_for_this_rel } else { format!("entities:{}", source_for_this_rel) };
        
        let mut set_clauses = vec![
            "project_id = type::record($pid)".to_string(),
        ];
        
        bind_data.insert(format!("rt_{}", i), Value::String(rel.rel_type.clone()));
        set_clauses.push(format!("rel_type = $rt_{}", i));
        
        if let Some(desc) = &rel.description {
            bind_data.insert(format!("desc_{}", i), Value::String(desc.clone()));
            set_clauses.push(format!("description = $desc_{}", i));
        }
        
        if let Some(strength) = rel.strength {
            bind_data.insert(format!("str_{}", i), serde_json::json!(strength));
            set_clauses.push(format!("strength = $str_{}", i));
        }
        
        if rel.attributes.is_null() {
            set_clauses.push("attributes = {}".to_string());
        } else {
            bind_data.insert(format!("attr_{}", i), rel.attributes.clone());
            set_clauses.push(format!("attributes = $attr_{}", i));
        }
        
        if let Some(sc) = &rel.start_chapter {
            if !sc.is_empty() {
                bind_data.insert(format!("sc_{}", i), Value::String(sc.clone()));
                set_clauses.push(format!("start_chapter = type::record($sc_{})", i));
            }
        }
        
        if let Some(ec) = &rel.end_chapter {
            if !ec.is_empty() {
                bind_data.insert(format!("ec_{}", i), Value::String(ec.clone()));
                set_clauses.push(format!("end_chapter = type::record($ec_{})", i));
            }
        }
        
        query.push_str(&format!(
            "RELATE {} -> entity_rel -> {} SET {};\n",
            from_for_this_rel, to_full, set_clauses.join(", ")
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


pub async fn save_entity_with_relations_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
    foreign_updates: Vec<Entity>,
) -> Result<Entity, String> {
    let mut val = serde_json::to_value(&entity).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.remove("id"); obj.remove("created_at"); obj.remove("updated_at"); obj.remove("project_id");
    }

    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    
    let mut query = String::from("BEGIN TRANSACTION;\n");
    let mut bind_data = Map::new();
    
    let main_entity_id = if let Some(id_str) = &entity.id {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        safe_id("entities", actual_id)
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
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
    
    query.push_str(&format!("LET $saved = (UPSERT type::record($main_id) SET {});\n", set_clause));
    
    let num_foreign_updates = foreign_updates.len();
    
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
    
    let mut q = db.query(query.clone());
    for (k, v) in bind_data.clone() {
        q = q.bind((k.as_str(), v));
    }
    
    let mut res = q.await.map_err(|e| e.to_string())?;
    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(format!("Transaction errors: {:?}", errors));
    }
    
    let num_statements = num_foreign_updates + 4;
    let saved_val: Option<Value> = res.take(num_statements - 1).map_err(|e| e.to_string())?;
    
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
    fn flatten_thing_leaves_plain_value_alone() {
        let mut val = json!({ "key": { "tb": "entities", "id": { "Object": "x" } } });
        flatten_thing(&mut val);
        assert!(val["key"]["tb"] == "entities");
    }

    #[test]
    fn flatten_thing_does_not_touch_non_thing_objects() {
        let mut val = json!({ "key": { "hello": "world" } });
        flatten_thing(&mut val);
        assert_eq!(val["key"]["hello"], "world");
    }
}

