use super::errors::BatchError;
use crate::logic::entities::{deserialize_list, flatten_thing, safe_id, safe_pid};
use crate::logic::models::{Entity, EntityRel};
use serde_json::{Map, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn get_entities_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_types: Vec<String>,
) -> Result<Map<String, Value>, BatchError> {
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

    let mut res = db
        .query(&query)
        .bind(("types", entity_types.clone()))
        .await?;

    let values: Vec<Value> = res.take(0)?;
    let entities: Vec<Entity> = deserialize_list(values);

    for entity_type in entity_types {
        result_map.insert(entity_type, Value::Array(Vec::new()));
    }

    for entity in entities {
        if let Some(Value::Array(arr)) = result_map.get_mut(&entity.entity_type) {
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
) -> Result<(), BatchError> {
    let proj_id = format!("projects:{}", project.trim().replace("projects:", ""));

    let from_full = if source_id.contains(':') {
        source_id.to_string()
    } else {
        format!("entities:{}", source_id)
    };

    let mut query = String::from("BEGIN TRANSACTION;\n");

    query.push_str(&format!(
        "DELETE entity_rel WHERE project_id = type::record($pid) AND (in = type::record('{0}') OR out = type::record('{0}'));\n",
        from_full
    ));

    let mut bind_data = Map::new();
    bind_data.insert("pid".to_string(), Value::String(proj_id));

    for (i, rel) in connections.into_iter().enumerate() {
        let EntityRel {
            out,
            r#in,
            rel_type,
            description,
            strength,
            attributes,
            start_chapter,
            end_chapter,
            ..
        } = rel;

        let target_id = out.unwrap_or_default();
        if target_id.is_empty() {
            continue;
        }

        let to_full = if target_id.contains(':') {
            target_id
        } else {
            format!("entities:{}", target_id)
        };
        let source_for_this_rel = r#in.unwrap_or_else(|| source_id.to_string());
        let from_for_this_rel = if source_for_this_rel.contains(':') {
            source_for_this_rel
        } else {
            format!("entities:{}", source_for_this_rel)
        };

        let mut set_clauses = vec!["project_id = type::record($pid)".to_string()];

        bind_data.insert(format!("rt_{}", i), Value::String(rel_type));
        set_clauses.push(format!("rel_type = $rt_{}", i));

        if let Some(desc) = description {
            bind_data.insert(format!("desc_{}", i), Value::String(desc));
            set_clauses.push(format!("description = $desc_{}", i));
        }

        if let Some(strength_val) = strength {
            bind_data.insert(format!("str_{}", i), serde_json::json!(strength_val));
            set_clauses.push(format!("strength = $str_{}", i));
        }

        if attributes.is_null() {
            set_clauses.push("attributes = {}".to_string());
        } else {
            bind_data.insert(format!("attr_{}", i), attributes);
            set_clauses.push(format!("attributes = $attr_{}", i));
        }

        if let Some(sc) = start_chapter {
            if !sc.is_empty() {
                bind_data.insert(format!("sc_{}", i), Value::String(sc));
                set_clauses.push(format!("start_chapter = type::record($sc_{})", i));
            }
        }

        if let Some(ec) = end_chapter {
            if !ec.is_empty() {
                bind_data.insert(format!("ec_{}", i), Value::String(ec));
                set_clauses.push(format!("end_chapter = type::record($ec_{})", i));
            }
        }

        query.push_str(&format!(
            "RELATE {} -> entity_rel -> {} SET {};\n",
            from_for_this_rel,
            to_full,
            set_clauses.join(", ")
        ));
    }

    query.push_str("COMMIT TRANSACTION;\n");

    let mut q = db.query(query);
    for (k, v) in bind_data {
        q = q.bind((k.as_str(), v));
    }

    let mut res = q.await?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(BatchError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}

pub async fn save_entity_with_relations_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
    foreign_updates: Vec<Entity>,
) -> Result<Entity, BatchError> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);

    let mut query = String::from("BEGIN TRANSACTION;\n");
    let mut bind_data = Map::new();

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
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 {
            parts[1]
        } else {
            id_str.as_str()
        };
        safe_id("entities", actual_id)
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        format!("entities:{}", new_id)
    };

    let has_desc = description.is_some();
    let has_attrs = !attributes.is_null();
    let has_tags = !tags.is_empty();
    let has_embeds = embeddings.is_some();

    bind_data.insert("main_id".to_string(), Value::String(main_entity_id));
    bind_data.insert("entity_type".to_string(), Value::String(entity_type));
    bind_data.insert("name".to_string(), Value::String(name));

    if let Some(d) = description {
        bind_data.insert("desc".to_string(), Value::String(d));
    }
    if has_attrs {
        bind_data.insert("attrs".to_string(), attributes);
    }
    if has_tags {
        if let Ok(tv) = serde_json::to_value(tags) {
            bind_data.insert("tags".to_string(), tv);
        }
    }
    if let Some(e) = embeddings {
        bind_data.insert("embeds".to_string(), e);
    }

    let desc_str = if has_desc { ", description = $desc" } else { "" };
    let attrs_str = if has_attrs { ", attributes = $attrs" } else { "" };
    let tags_str = if has_tags { ", tags = $tags" } else { "" };
    let embeds_str = if has_embeds { ", embeddings = $embeds" } else { "" };

    let set_clause = format!(
        "project_id = {}, entity_type = $entity_type, name = $name{}{}{}{}",
        pid_literal, desc_str, attrs_str, tags_str, embeds_str
    );

    query.push_str(&format!(
        "LET $saved = (UPSERT type::record($main_id) SET {});\n",
        set_clause
    ));

    let num_foreign_updates = foreign_updates.len();

    for (i, foreign) in foreign_updates.into_iter().enumerate() {
        let Entity {
            id: fid_opt,
            entity_type: f_et,
            name: f_name,
            description: f_desc,
            attributes: f_attrs,
            tags: f_tags,
            embeddings: f_embeds,
            ..
        } = foreign;

        if let Some(fid) = fid_opt {
            let fparts: Vec<&str> = fid.splitn(2, ':').collect();
            let factual_id = if fparts.len() == 2 {
                fparts[1]
            } else {
                fid.as_str()
            };
            let foreign_full_id = safe_id("entities", factual_id);

            let var_name = format!("foreign_data_{}", i);
            let id_var = format!("foreign_id_{}", i);

            bind_data.insert(id_var.clone(), Value::String(foreign_full_id));
            bind_data.insert(format!("{}_et", var_name), Value::String(f_et));
            bind_data.insert(format!("{}_name", var_name), Value::String(f_name));

            let mut f_set = format!(
                "project_id = {}, entity_type = ${}_et, name = ${}_name",
                pid_literal, var_name, var_name
            );

            if let Some(d) = f_desc {
                bind_data.insert(format!("{}_desc", var_name), Value::String(d));
                f_set.push_str(&format!(", description = ${}_desc", var_name));
            }
            if !f_attrs.is_null() {
                bind_data.insert(format!("{}_attrs", var_name), f_attrs);
                f_set.push_str(&format!(", attributes = ${}_attrs", var_name));
            }
            if !f_tags.is_empty() {
                if let Ok(tv) = serde_json::to_value(f_tags) {
                    bind_data.insert(format!("{}_tags", var_name), tv);
                    f_set.push_str(&format!(", tags = ${}_tags", var_name));
                }
            }
            if let Some(e) = f_embeds {
                bind_data.insert(format!("{}_embeds", var_name), e);
                f_set.push_str(&format!(", embeddings = ${}_embeds", var_name));
            }

            query.push_str(&format!(
                "UPSERT type::record(${id_var}) SET {};\n",
                f_set
            ));
        }
    }

    query.push_str("COMMIT TRANSACTION;\nRETURN $saved;\n");

    let mut q = db.query(query);
    for (k, v) in bind_data {
        q = q.bind((k.as_str(), v));
    }

    let mut res = q.await?;
    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(BatchError::Transaction(format!("{:?}", errors)));
    }

    let num_statements = num_foreign_updates + 4;
    let saved_val: Option<Value> = res.take(num_statements - 1)?;

    if let Some(val) = saved_val {
        let mut v = if let Value::Array(arr) = val {
            if let Some(first) = arr.into_iter().next() {
                first
            } else {
                return Err(BatchError::OperationFailed("Failed to retrieve saved entity (empty array)".to_string()));
            }
        } else {
            val
        };
        flatten_thing(&mut v);
        return Ok(serde_json::from_value(v)?);
    }

    Err(BatchError::OperationFailed("Failed to retrieve saved entity from transaction".to_string()))
}

