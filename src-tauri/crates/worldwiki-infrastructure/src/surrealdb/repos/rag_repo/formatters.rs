use super::types::EntitySearchDto;
use serde_json::Value;

pub fn format_entity_search_dto(ent: &EntitySearchDto) -> Value {
    let name = ent.name.as_deref().unwrap_or("Сущность");
    let type_key = ent.type_key.as_deref().unwrap_or("entity");
    let desc = ent.description.as_deref().unwrap_or("");
    let tags = ent.tags.as_ref().map(|arr| arr.join(", ")).unwrap_or_default();

    let mut out = format!("[СУЩНОСТЬ: {name} (тип: {type_key})]\n");
    if !tags.is_empty() {
        out.push_str(&format!("Теги: {tags}\n"));
    }
    if !desc.trim().is_empty() {
        out.push_str(&format!("Описание: {}\n", desc.trim()));
    }
    if let Some(attrs) = ent.attributes.as_ref().and_then(|v| v.as_object()) {
        for (k, v) in attrs {
            if k == "embeddings" || k.starts_with('_') {
                continue;
            }
            let val_str = match v {
                Value::String(s) if !s.trim().is_empty() => s.clone(),
                Value::Array(arr) if !arr.is_empty() => {
                    let items: Vec<String> = arr
                        .iter()
                        .filter_map(|item| match item {
                            Value::String(s) => {
                                let trimmed = s.trim();
                                if trimmed.is_empty() {
                                    None
                                } else {
                                    Some(trimmed.to_string())
                                }
                            }
                            Value::Object(o) => {
                                if let Some(n) = o.get("название").and_then(|x| x.as_str()) {
                                    let trimmed = n.trim();
                                    if trimmed.is_empty() {
                                        None
                                    } else {
                                        Some(trimmed.to_string())
                                    }
                                } else {
                                    Some(item.to_string())
                                }
                            }
                            Value::Null => None,
                            _ => Some(item.to_string()),
                        })
                        .collect();
                    items.join(", ")
                }
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => String::new(),
            };
            if !val_str.is_empty() {
                out.push_str(&format!("- {k}: {val_str}\n"));
            }
        }
    }
    serde_json::json!({
        "id": ent.id,
        "name": name,
        "type_key": type_key,
        "title": name,
        "content": out,
        "source_type": "entity",
        "tags": ent.tags,
        "attributes": ent.attributes,
    })
}

pub fn format_entity_dossier_value(row: &Value) -> Value {
    let mut obj = row.as_object().cloned().unwrap_or_default();
    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .or_else(|| obj.get("title").and_then(|v| v.as_str()))
        .unwrap_or("Сущность");
    let type_key = obj.get("type_key").and_then(|v| v.as_str()).unwrap_or("entity");
    let desc = obj
        .get("description")
        .and_then(|v| v.as_str())
        .or_else(|| obj.get("content").and_then(|v| v.as_str()))
        .unwrap_or("");
    let tags = obj
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();

    let mut out = format!("[СУЩНОСТЬ: {name} (тип: {type_key})]\n");
    if !tags.is_empty() {
        out.push_str(&format!("Теги: {tags}\n"));
    }
    if !desc.trim().is_empty() {
        out.push_str(&format!("Описание: {}\n", desc.trim()));
    }
    if let Some(attrs) = obj.get("attributes").and_then(|v| v.as_object()) {
        for (k, v) in attrs {
            if k == "embeddings" || k.starts_with('_') {
                continue;
            }
            let val_str = match v {
                Value::String(s) if !s.trim().is_empty() => s.clone(),
                Value::Array(arr) if !arr.is_empty() => {
                    let items: Vec<String> = arr
                        .iter()
                        .filter_map(|item| match item {
                            Value::String(s) => {
                                let trimmed = s.trim();
                                if trimmed.is_empty() {
                                    None
                                } else {
                                    Some(trimmed.to_string())
                                }
                            }
                            Value::Object(o) => {
                                if let Some(n) = o.get("название").and_then(|x| x.as_str()) {
                                    let trimmed = n.trim();
                                    if trimmed.is_empty() {
                                        None
                                    } else {
                                        Some(trimmed.to_string())
                                    }
                                } else {
                                    Some(item.to_string())
                                }
                            }
                            Value::Null => None,
                            _ => Some(item.to_string()),
                        })
                        .collect();
                    items.join(", ")
                }
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => String::new(),
            };
            if !val_str.is_empty() {
                out.push_str(&format!("- {k}: {val_str}\n"));
            }
        }
    }
    obj.insert("title".to_string(), Value::String(name.to_string()));
    obj.insert("content".to_string(), Value::String(out));
    obj.insert("source_type".to_string(), Value::String("entity".to_string()));
    Value::Object(obj)
}
