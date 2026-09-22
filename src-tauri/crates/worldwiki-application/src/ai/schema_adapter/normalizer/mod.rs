pub mod container_parser;
pub mod field_parser;

pub(crate) use container_parser::parse_dynamic_container;
pub(crate) use field_parser::parse_field_def;

use serde_json::Value;
use std::collections::HashMap;
use worldwiki_domain::knowledge::{
    NormalizedDynamicListDef, NormalizedEntitySchema, NormalizedFieldDef,
};

/// Нормализует сырой full_schema (с секциями, dynamicContainers, templates, fieldOverrides)
/// в чистый `NormalizedEntitySchema` без UI-мусора.
pub fn normalize(full_schema: &Value, ui_templates: Option<&Value>) -> NormalizedEntitySchema {
    let entity_type = full_schema
        .get("entityType")
        .or_else(|| full_schema.get("type_key"))
        .and_then(|v| v.as_str())
        .unwrap_or("entity")
        .to_string();

    let title = full_schema
        .get("title")
        .or_else(|| full_schema.get("name"))
        .or_else(|| full_schema.get("type_name"))
        .and_then(|v| v.as_str())
        .unwrap_or(&entity_type)
        .to_string();

    let mut flat_fields: HashMap<String, NormalizedFieldDef> = HashMap::new();
    let mut dynamic_lists: HashMap<String, NormalizedDynamicListDef> = HashMap::new();

    // Сбор шаблонов (локальных и глобальных ui_editor.json)
    let mut all_templates: HashMap<String, Value> = HashMap::new();
    if let Some(Value::Object(t_map)) = ui_templates.and_then(|v| v.get("templates")) {
        for (k, v) in t_map {
            all_templates.insert(k.clone(), v.clone());
        }
    }
    if let Some(Value::Object(t_map)) = full_schema.get("templates") {
        for (k, v) in t_map {
            all_templates.insert(k.clone(), v.clone());
        }
    }

    // Обход секций
    if let Some(sections) = full_schema.get("sections").and_then(|v| v.as_array()) {
        for sec in sections {
            // 1. Плоские поля
            if let Some(fields) = sec.get("fields").and_then(|v| v.as_array()) {
                for f in fields {
                    if let Some(fd) = parse_field_def(f) {
                        flat_fields.insert(fd.key.clone(), fd);
                    }
                }
            }

            // Старый формат items
            if let Some(items) = sec.get("items").and_then(|v| v.as_array()) {
                for it in items {
                    let is_dyn = it.get("template").is_some()
                        || it.get("dataPath").is_some()
                        || it.get("type").and_then(|s| s.as_str()) == Some("dynamic")
                        || it.get("type").and_then(|s| s.as_str()) == Some("timeline");

                    if !is_dyn {
                        if let Some(fd) = parse_field_def(it) {
                            flat_fields.insert(fd.key.clone(), fd);
                        }
                    }
                }
            }

            // 2. Динамические контейнеры
            if let Some(dyn_containers) = sec.get("dynamicContainers").and_then(|v| v.as_array()) {
                for dc in dyn_containers {
                    if let Some(dld) = parse_dynamic_container(dc, &all_templates) {
                        dynamic_lists.insert(dld.data_path.clone(), dld);
                    }
                }
            }

            if let Some(items) = sec.get("items").and_then(|v| v.as_array()) {
                for it in items {
                    let is_dyn = it.get("template").is_some()
                        || it.get("dataPath").is_some()
                        || it.get("type").and_then(|s| s.as_str()) == Some("dynamic")
                        || it.get("type").and_then(|s| s.as_str()) == Some("timeline");

                    if is_dyn {
                        if let Some(dld) = parse_dynamic_container(it, &all_templates) {
                            dynamic_lists.insert(dld.data_path.clone(), dld);
                        }
                    }
                }
            }
        }
    }

    // Гарантируем системные поля
    if !flat_fields.contains_key("название") {
        flat_fields.insert(
            "название".to_string(),
            NormalizedFieldDef {
                key: "название".to_string(),
                label: "Название".to_string(),
                field_type: "text".to_string(),
                required: true,
                options: vec![],
                entity_type_ref: None,
                description: Some("Имя или наименование сущности".to_string()),
                default_value: None,
            },
        );
    }

    if !flat_fields.contains_key("описание") {
        flat_fields.insert(
            "описание".to_string(),
            NormalizedFieldDef {
                key: "описание".to_string(),
                label: "Описание".to_string(),
                field_type: "textarea".to_string(),
                required: false,
                options: vec![],
                entity_type_ref: None,
                description: Some("Основное текстовое описание".to_string()),
                default_value: None,
            },
        );
    }

    NormalizedEntitySchema {
        entity_type,
        title,
        flat_fields,
        dynamic_lists,
    }
}
