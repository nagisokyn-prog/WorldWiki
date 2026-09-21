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
    let mut val = serde_json::to_value(&entity)?;
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

        let mut res = q.await?;
        let saved: Option<Value> = res.take(0)?;
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

        let mut res = q.await?;
        let saved: Option<Value> = res.take(0)?;
        saved
    };

    match result {
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
