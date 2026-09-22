use serde_json::{json, Value};
use worldwiki_domain::knowledge::{NormalizedDynamicListDef, NormalizedEntitySchema, NormalizedFieldDef};

/// Генерирует строгую, плоскую и инлайновую JSON Schema (без `$ref` и `$defs`)
/// для целевой секции или всей сущности. Подходит для llama.cpp `json_schema_to_grammar` и OpenAI Strict Mode.
pub fn to_scoped_json_schema(schema: &NormalizedEntitySchema, target_key: Option<&str>) -> Value {
    let mut properties = serde_json::Map::new();
    let mut required_keys = Vec::new();

    if let Some(target) = target_key {
        // Схема под конкретный динамический контейнер
        if let Some(dyn_list) = schema.dynamic_lists.get(target) {
            let item_schema = build_item_json_schema(dyn_list);
            properties.insert(
                target.to_string(),
                json!({
                    "type": "array",
                    "description": dyn_list.label,
                    "items": item_schema
                }),
            );
            required_keys.push(target.to_string());
        } else if let Some(f_def) = schema.flat_fields.get(target) {
            properties.insert(target.to_string(), build_field_json_schema(f_def));
            if f_def.required {
                required_keys.push(target.to_string());
            }
        }
    } else {
        // Вся плоская схема сущности
        for (k, f_def) in &schema.flat_fields {
            properties.insert(k.clone(), build_field_json_schema(f_def));
            if f_def.required {
                required_keys.push(k.clone());
            }
        }

        for (k, dyn_list) in &schema.dynamic_lists {
            let item_schema = build_item_json_schema(dyn_list);
            properties.insert(
                k.clone(),
                json!({
                    "type": "array",
                    "description": dyn_list.label,
                    "items": item_schema
                }),
            );
        }
    }

    json!({
        "type": "object",
        "properties": properties,
        "required": required_keys,
        "additionalProperties": false
    })
}

pub(crate) fn build_field_json_schema(f: &NormalizedFieldDef) -> Value {
    let desc = f.description.clone().unwrap_or_else(|| f.label.clone());
    match f.field_type.as_str() {
        "textarea" | "text" => json!({
            "type": "string",
            "description": desc
        }),
        "number" | "range" => json!({
            "type": "number",
            "description": desc
        }),
        "boolean" => json!({
            "type": "boolean",
            "description": desc
        }),
        "select" => {
            if !f.options.is_empty() {
                json!({
                    "type": "string",
                    "enum": f.options,
                    "description": desc
                })
            } else {
                json!({
                    "type": "string",
                    "description": desc
                })
            }
        }
        "tags" => json!({
            "type": "array",
            "items": { "type": "string" },
            "description": desc
        }),
        "entity_ref" | "chapter_ref" => json!({
            "type": "string",
            "description": format!("{} (ID или имя сущности)", desc)
        }),
        _ => json!({
            "type": "string",
            "description": desc
        }),
    }
}

pub(crate) fn build_item_json_schema(dyn_list: &NormalizedDynamicListDef) -> Value {
    let mut props = serde_json::Map::new();
    let mut reqs = Vec::new();

    for (k, f_def) in &dyn_list.item_fields {
        props.insert(k.clone(), build_field_json_schema(f_def));
        if f_def.required {
            reqs.push(k.clone());
        }
    }

    json!({
        "type": "object",
        "properties": props,
        "required": reqs,
        "additionalProperties": false
    })
}

/// Генерирует лаконичный Fill Guide для системного промпта
pub fn to_fill_guide(schema: &NormalizedEntitySchema) -> String {
    let mut lines = Vec::new();
    lines.push(format!(
        "### Схема полей для типа '{}' ({}):",
        schema.entity_type, schema.title
    ));
    lines.push("Плоские поля (flat_fields):".to_string());
    for (k, f) in &schema.flat_fields {
        let req = if f.required { " [ОБЯЗАТЕЛЬНО]" } else { "" };
        let opts = if !f.options.is_empty() {
            format!(" (варианты: {:?})", f.options)
        } else {
            String::new()
        };
        lines.push(format!("  • `{}` ({}{}) — {}{}", k, f.field_type, req, f.label, opts));
    }

    if !schema.dynamic_lists.is_empty() {
        lines.push("\nДинамические списки (массивы объектов):".to_string());
        for (k, d) in &schema.dynamic_lists {
            lines.push(format!("  • `{}`: массив элементов [{}] со структурой:", k, d.label));
            for (ik, iv) in &d.item_fields {
                lines.push(format!("      - `{}` ({}) — {}", ik, iv.field_type, iv.label));
            }
        }
    }

    lines.join("\n")
}
