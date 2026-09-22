use crate::errors::ApplicationError;
use crate::knowledge::KnowledgeServices;
use serde_json::Value;
use std::sync::Arc;
use worldwiki_domain::knowledge::{Entity, EntityRelation};

pub async fn manage_entity(
    knowledge: &Arc<KnowledgeServices>,
    action: &str,
    payload: Value,
) -> Result<Value, ApplicationError> {
    match action {
        "create" | "update" => upsert_entity(knowledge, payload).await,
        "relate" => {
            let rel: EntityRelation = serde_json::from_value(payload)
                .map_err(|e| ApplicationError::Validation(e.to_string()))?;
            knowledge.add_relation(&rel).await?;
            Ok(serde_json::json!({ "status": "success", "relation_id": rel.id }))
        }
        "delete" => {
            let entity_id = if let Some(s) = payload.as_str() {
                s.to_string()
            } else if let Some(id) = payload
                .get("entity_id")
                .or_else(|| payload.get("id"))
                .and_then(|v| v.as_str())
            {
                id.to_string()
            } else {
                return Err(ApplicationError::Validation(
                    "Expected entity_id string or object with entity_id".into(),
                ));
            };
            knowledge.entity_repo.delete(&entity_id).await?;
            Ok(serde_json::json!({ "status": "success", "deleted_id": entity_id }))
        }
        _ => Err(ApplicationError::Validation(format!(
            "Unsupported action: {action}"
        ))),
    }
}

async fn upsert_entity(
    knowledge: &Arc<KnowledgeServices>,
    payload: Value,
) -> Result<Value, ApplicationError> {
    let mut obj = match payload {
        Value::Object(map) => map,
        _ => {
            return Err(ApplicationError::Validation(
                "Expected object payload for entity".into(),
            ))
        }
    };

    let raw_id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("").trim();
    let project_id = obj
        .get("project_id")
        .or_else(|| obj.get("projectId"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mut name = obj
        .get("name")
        .or_else(|| obj.get("название"))
        .or_else(|| obj.get("title"))
        .or_else(|| obj.get("label"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let mut existing_entity: Option<Entity> = None;

    if !raw_id.is_empty() {
        let full_id = if raw_id.starts_with("entities:") {
            raw_id.to_string()
        } else {
            format!("entities:{raw_id}")
        };
        if let Ok(card) = knowledge.get_full_card(&full_id).await {
            existing_entity = Some(card.entity);
        }
    }

    if existing_entity.is_none() && !name.is_empty() {
        let search_res = knowledge
            .entity_repo
            .search(&project_id, &name, 5)
            .await
            .unwrap_or_default();
        if let Some(matched) = search_res
            .iter()
            .find(|e| e.name.eq_ignore_ascii_case(&name))
        {
            if let Ok(card) = knowledge.get_full_card(&matched.id).await {
                existing_entity = Some(card.entity);
            }
        }
    }

    let (entity_id, type_key, created_at, mut base_attributes, existing_tags) =
        if let Some(ref prev) = existing_entity {
            let prev_attrs = match &prev.attributes {
                Value::Object(m) => m.clone(),
                _ => serde_json::Map::new(),
            };
            (
                prev.id.clone(),
                obj.get("type_key")
                    .or_else(|| obj.get("entity_type"))
                    .or_else(|| obj.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&prev.type_key)
                    .to_string(),
                prev.created_at,
                prev_attrs,
                prev.tags.clone(),
            )
        } else {
            let is_safe_ascii = !raw_id.is_empty()
                && raw_id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ':');
            let gen_id = if raw_id.is_empty() || !is_safe_ascii {
                format!("entities:char_{}", uuid::Uuid::new_v4().simple())
            } else if !raw_id.starts_with("entities:") {
                format!("entities:{raw_id}")
            } else {
                raw_id.to_string()
            };

            let t_key = obj
                .get("type_key")
                .or_else(|| obj.get("entity_type"))
                .or_else(|| obj.get("type"))
                .and_then(|v| v.as_str())
                .unwrap_or("character")
                .to_string();

            (
                gen_id,
                t_key,
                chrono::Utc::now(),
                serde_json::Map::new(),
                Vec::new(),
            )
        };

    let description = obj
        .get("description")
        .or_else(|| obj.get("описание"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| existing_entity.as_ref().and_then(|e| e.description.clone()));

    let mut tags = existing_tags;
    if let Some(new_tags) = obj.get("tags").and_then(|v| v.as_array()) {
        for t in new_tags
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
        {
            if !tags.contains(&t) {
                tags.push(t);
            }
        }
    }

    if let Some(Value::Object(incoming_attrs)) = obj.remove("attributes") {
        for (k, v) in incoming_attrs {
            base_attributes.insert(k, v);
        }
    }

    if name.is_empty() {
        if let Some(n) = base_attributes.get("название").and_then(|v| v.as_str()) {
            name = n.trim().to_string();
        }
    }

    if name.is_empty() {
        name = existing_entity
            .as_ref()
            .map(|e| e.name.clone())
            .unwrap_or_else(|| "Новая сущность".to_string());
    }

    base_attributes.insert("название".to_string(), Value::String(name.clone()));
    if let Some(ref d) = description {
        base_attributes.insert("описание".to_string(), Value::String(d.clone()));
    }

    for (k, v) in obj {
        if ![
            "id",
            "project_id",
            "projectId",
            "type_key",
            "entity_type",
            "type",
            "name",
            "tags",
            "created_at",
            "updated_at",
            "description",
            "описание",
        ]
        .contains(&k.as_str())
        {
            base_attributes.insert(k, v);
        }
    }

    // Strict Schema Validation
    let norm_schema = crate::ai::schema_adapter::SchemaAdapter::load_schema(&type_key);
    let attrs_val = Value::Object(base_attributes.clone());
    if let Err(val_errs) =
        crate::ai::schema_adapter::SchemaAdapter::validate_attributes(&norm_schema, &attrs_val)
    {
        return Ok(serde_json::json!({
            "status": "validation_error",
            "is_error": true,
            "type_key": type_key,
            "entity_name": name,
            "errors": val_errs,
            "hint": format!("Пожалуйста, исправьте поля сущности '{}' в соответствии со схемой и повторите вызов entity_manage.", norm_schema.title)
        }));
    }

    let entity = Entity {
        id: entity_id.clone(),
        project_id,
        type_key: type_key.clone(),
        name: name.clone(),
        description,
        attributes: Value::Object(base_attributes),
        tags,
        created_at,
        updated_at: chrono::Utc::now(),
    };

    knowledge.save_entity(&entity).await?;

    let _ = knowledge
        .events
        .publish_raw(
            "ww-entity-saved",
            serde_json::json!({
                "type": entity.type_key,
                "id": entity.id
            }),
        )
        .await;

    let status = if existing_entity.is_some() {
        "updated"
    } else {
        "created"
    };
    Ok(serde_json::json!({
        "status": status,
        "entity_id": entity.id,
        "name": entity.name,
        "type_key": entity.type_key
    }))
}
