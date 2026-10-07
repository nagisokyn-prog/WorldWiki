use crate::ai::tools::id_cleaner::clean_record_id;
use crate::errors::ApplicationError;
use crate::knowledge::KnowledgeServices;
use serde_json::Value;
use std::sync::Arc;

pub async fn inspect_entity(
    knowledge: &Arc<KnowledgeServices>,
    project_id: &str,
    entity_id_or_query: &str,
) -> Result<Value, ApplicationError> {
    let query = entity_id_or_query.trim();
    if query.is_empty() {
        return Ok(serde_json::json!({
            "error": "entity_id or name cannot be empty",
            "hint": "Provide an entity_id or name, or use query_world to search entities."
        }));
    }

    // 0. Schema introspection request (e.g. "type:character", "schema:character" or "character")
    let clean_q = query.to_lowercase();
    if clean_q.starts_with("type:")
        || clean_q.starts_with("schema:")
        || [
            "character",
            "location",
            "faction",
            "organization",
            "item",
            "event",
            "state",
        ]
        .contains(&clean_q.as_str())
    {
        let norm_schema = crate::ai::schema_adapter::SchemaAdapter::load_schema(&clean_q);
        let fill_guide = crate::ai::schema_adapter::SchemaAdapter::to_fill_guide(&norm_schema);
        let scoped_schema =
            crate::ai::schema_adapter::SchemaAdapter::to_scoped_json_schema(&norm_schema, None);

        return Ok(serde_json::json!({
            "status": "schema_inspect",
            "entity_type": norm_schema.entity_type,
            "title": norm_schema.title,
            "fill_guide": fill_guide,
            "flat_fields_count": norm_schema.flat_fields.len(),
            "dynamic_lists_count": norm_schema.dynamic_lists.len(),
            "json_schema": scoped_schema,
            "hint": "Используйте названия полей из fill_guide или json_schema для entity_manage."
        }));
    }

    // 1. Try exact raw id first
    if let Ok(card) = knowledge.get_full_card(query).await {
        return Ok(serde_json::to_value(card).unwrap_or_default());
    }

    // 2. Try cleaned id with "entities:" prefix
    let cleaned_id = clean_record_id("entities", query);
    if cleaned_id != query
        && let Ok(card) = knowledge.get_full_card(&cleaned_id).await
    {
        return Ok(serde_json::to_value(card).unwrap_or_default());
    }

    // Fallback: search by name/query in the project
    let search_res = knowledge
        .entity_repo
        .search(project_id, query, 5)
        .await
        .unwrap_or_default();

    if search_res.is_empty() {
        Ok(serde_json::json!({
            "error": format!("Entity '{}' not found in project", query),
            "hint": "Use query_world to search the knowledge base for relevant entities."
        }))
    } else if search_res.len() == 1
        || search_res.iter().any(|e| e.name.eq_ignore_ascii_case(query))
    {
        let exact_match = match search_res
            .iter()
            .find(|e| e.name.eq_ignore_ascii_case(query))
        {
            Some(m) => m,
            None => match search_res.first() {
                Some(f) => f,
                None => return Ok(serde_json::json!({"error": "Entity not found"})),
            },
        };
        let card = knowledge.get_full_card(&exact_match.id).await?;
        Ok(serde_json::to_value(card).unwrap_or_default())
    } else {
        let candidates: Vec<Value> = search_res
            .into_iter()
            .map(|e| {
                serde_json::json!({
                    "id": e.id,
                    "name": e.name,
                    "description": e.description
                })
            })
            .collect();
        Ok(serde_json::json!({
            "status": "disambiguation_needed",
            "message": format!("Entity '{}' matched multiple candidates in project", query),
            "candidates": candidates,
            "hint": "Please call inspect_entity with the exact id from candidates."
        }))
    }
}
