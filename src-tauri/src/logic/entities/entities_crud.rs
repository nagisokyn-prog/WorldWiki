use super::errors::EntityError;
use super::types::{deserialize_list, flatten_thing, safe_id, safe_pid};
use crate::logic::models::Entity;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// ENTITY CORE CRUD
// =====================================================

pub async fn get_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let query = match &entity_type {
        Some(_et) => format!(
            "SELECT * FROM entities WHERE (project_id = '{}' OR project_id = {}) AND entity_type = $et",
            pid_val, pid_literal
        ),
        None => format!(
            "SELECT * FROM entities WHERE project_id = '{}' OR project_id = {}",
            pid_val, pid_literal
        ),
    };

    let mut q = db.query(&query);

    if let Some(et) = entity_type {
        q = q.bind(("et", et));
    }

    let mut res = q.await?;
    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn get_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<Option<Entity>, EntityError> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { id };
    let res: Option<Value> = db.select(("entities", actual_id)).await?;

    if let Some(mut val) = res {
        flatten_thing(&mut val);
        match serde_json::from_value(val) {
            Ok(e) => return Ok(Some(e)),
            Err(e) => {
                eprintln!("[DEBUG get_entity] error: {}", e);
                return Ok(None);
            }
        }
    }
    Ok(None)
}

pub async fn save_entity_inner(
    db: &Surreal<Db>,
    project: &str,
    entity: Entity,
) -> Result<Entity, EntityError> {
    let pid_val = safe_pid(project);
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);

    let id_opt = entity.id;
    let entity_type = entity.entity_type;
    let name = entity.name;
    let description = entity.description;
    let attributes = entity.attributes;
    let tags = entity.tags;
    let embeddings = entity.embeddings;

    let has_desc = description.is_some();
    let has_attrs = !attributes.is_null();
    let has_tags = !tags.is_empty();
    let has_embeds = embeddings.is_some();

    let mut query = if let Some(ref id_str) = id_opt {
        let parts: Vec<&str> = id_str.splitn(2, ':').collect();
        let actual_id = if parts.len() == 2 { parts[1] } else { id_str.as_str() };
        let id_val = safe_id("entities", actual_id);
        format!(
            "UPSERT type::record('{}') SET project_id = {}, entity_type = $entity_type, name = $name",
            id_val, pid_literal
        )
    } else {
        format!(
            "CREATE entities SET project_id = {}, entity_type = $entity_type, name = $name",
            pid_literal
        )
    };

    if has_desc {
        query.push_str(", description = $desc");
    }
    if has_attrs {
        query.push_str(", attributes = $attrs");
    }
    if has_tags {
        query.push_str(", tags = $tags");
    }
    if has_embeds {
        query.push_str(", embeddings = $embeds");
    }

    let mut q = db
        .query(query)
        .bind(("entity_type", entity_type))
        .bind(("name", name));

    if let Some(d) = description {
        q = q.bind(("desc", d));
    }
    if has_attrs {
        q = q.bind(("attrs", attributes));
    }
    if has_tags {
        q = q.bind(("tags", tags));
    }
    if let Some(e) = embeddings {
        q = q.bind(("embeds", e));
    }

    let mut res = q.await?;
    let saved: Option<Value> = res.take(0)?;

    match saved {
        Some(mut v) => {
            flatten_thing(&mut v);
            let parsed: Entity = serde_json::from_value(v)?;
            Ok(parsed)
        }
        None => Err(EntityError::OperationFailed("Entity not saved".to_string())),
    }
}

pub async fn delete_entity_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<(), EntityError> {
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
        .await?;

    let errors = tx_res.take_errors();
    if !errors.is_empty() {
        return Err(EntityError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}

pub async fn search_entities_inner(
    db: &Surreal<Db>,
    project: &str,
    query: &str,
    entity_type: Option<String>,
) -> Result<Vec<Entity>, EntityError> {
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

    let mut res = q.await?;
    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}
