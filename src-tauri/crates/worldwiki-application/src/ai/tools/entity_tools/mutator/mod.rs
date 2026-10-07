pub mod id_resolver;
pub mod merger;

use crate::errors::ApplicationError;
use crate::knowledge::KnowledgeServices;
use id_resolver::{find_existing_entity, resolve_entity_id};
use merger::{merge_attributes_and_extra_fields, merge_entity_tags};
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
    let obj = match payload {
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

    let existing_entity = find_existing_entity(knowledge, raw_id, &project_id, &name).await;
    let is_update = existing_entity.is_some();

    let (
        entity_id,
        type_key,
        created_at,
        base_attributes,
        existing_tags,
        existing_desc,
        existing_name,
    ) = if let Some(prev) = existing_entity {
        let prev_attrs = match prev.attributes {
            Value::Object(m) => m,
            _ => serde_json::Map::new(),
        };
        let t_key = obj
            .get("type_key")
            .or_else(|| obj.get("entity_type"))
            .or_else(|| obj.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or(&prev.type_key)
            .to_string();
        (
            prev.id,
            t_key,
            prev.created_at,
            prev_attrs,
            prev.tags,
            prev.description,
            Some(prev.name),
        )
    } else {
        let gen_id = resolve_entity_id(raw_id);
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
            None,
            None,
        )
    };

    let description = obj
        .get("description")
        .or_else(|| obj.get("описание"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or(existing_desc);

    let tags = merge_entity_tags(existing_tags, obj.get("tags"));

    if name.is_empty()
        && let Some(n) = base_attributes.get("название").and_then(|v| v.as_str())
    {
        name = n.trim().to_string();
    }

    if name.is_empty() {
        name = existing_name.unwrap_or_else(|| "Новая сущность".to_string());
    }

    let final_attributes =
        merge_attributes_and_extra_fields(base_attributes, obj, &name, description.as_deref());

    // Strict Schema Validation
    let norm_schema = crate::ai::schema_adapter::SchemaAdapter::load_schema(&type_key);
    let attrs_val = Value::Object(final_attributes);
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
        attributes: attrs_val,
        tags,
        created_at,
        updated_at: chrono::Utc::now(),
    };

    knowledge.save_entity(&entity).await?;

    if let Err(e) = knowledge
        .events
        .publish_raw(
            "ww-entity-saved",
            serde_json::json!({
                "type": entity.type_key,
                "id": entity.id
            }),
        )
        .await
    {
        eprintln!("[EntityMutator] Failed to publish entity saved event: {e}");
    }

    let status = if is_update { "updated" } else { "created" };
    Ok(serde_json::json!({
        "status": status,
        "entity_id": entity.id,
        "name": entity.name,
        "type_key": entity.type_key
    }))
}
