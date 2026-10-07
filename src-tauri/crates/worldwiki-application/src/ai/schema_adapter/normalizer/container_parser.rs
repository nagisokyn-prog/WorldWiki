use super::field_parser::parse_field_def;
use serde_json::Value;
use std::collections::HashMap;
use worldwiki_domain::knowledge::{NormalizedDynamicListDef, NormalizedFieldDef};

fn apply_override_field(
    item_fields: &mut HashMap<String, NormalizedFieldDef>,
    f_key: &str,
    ov_obj: &serde_json::Map<String, Value>,
) {
    if ov_obj.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false) {
        item_fields.remove(f_key);
        return;
    }
    if let Some(existing) = item_fields.get_mut(f_key) {
        if let Some(lbl) = ov_obj.get("label").and_then(|v| v.as_str()) {
            existing.label = lbl.to_string();
        }
        if let Some(pl) = ov_obj.get("placeholder").and_then(|v| v.as_str()) {
            existing.description = Some(pl.to_string());
        }
        if let Some(et) = ov_obj.get("entityType").and_then(|v| v.as_str()) {
            existing.entity_type_ref = Some(et.to_string());
            existing.field_type = "entity_ref".to_string();
        }
    } else {
        let mut synthetic_map = ov_obj.clone();
        synthetic_map.insert("path".to_string(), Value::String(f_key.to_string()));
        let synthetic = Value::Object(synthetic_map);
        if let Some(fd) = parse_field_def(&synthetic) {
            item_fields.insert(f_key.to_string(), fd);
        }
    }
}

pub(crate) fn parse_dynamic_container(
    dc: &Value,
    templates: &HashMap<&str, &Value>,
) -> Option<NormalizedDynamicListDef> {
    let data_path = dc
        .get("dataPath")
        .or_else(|| dc.get("id"))
        .or_else(|| dc.get("path"))
        .and_then(|v| v.as_str())?
        .to_string();

    let label = dc
        .get("label")
        .or_else(|| dc.get("title"))
        .and_then(|v| v.as_str())
        .unwrap_or(&data_path)
        .to_string();

    let is_timeline = dc.get("type").and_then(|v| v.as_str()) == Some("timeline")
        || dc.get("isTimeline").and_then(|v| v.as_bool()).unwrap_or(false);

    let mut item_fields: HashMap<String, NormalizedFieldDef> = HashMap::new();

    // 1. Поля из шаблона
    if let Some(tpl_name) = dc.get("template").and_then(|v| v.as_str())
        && let Some(tpl) = templates.get(tpl_name)
        && let Some(fields) = tpl.get("fields").and_then(|v| v.as_array())
    {
        for f in fields {
            if let Some(fd) = parse_field_def(f) {
                item_fields.insert(fd.key.clone(), fd);
            }
        }
    }

    // 2. Локальные поля контейнера
    if let Some(fields) = dc.get("fields").and_then(|v| v.as_array()) {
        for f in fields {
            if let Some(fd) = parse_field_def(f) {
                item_fields.insert(fd.key.clone(), fd);
            }
        }
    }

    // 3. fieldOverrides
    if let Some(overrides) = dc.get("fieldOverrides").and_then(|v| v.as_object()) {
        for (f_key, ov_val) in overrides {
            if let Some(ov_obj) = ov_val.as_object() {
                apply_override_field(&mut item_fields, f_key, ov_obj);
            }
        }
    }

    Some(NormalizedDynamicListDef {
        data_path,
        label,
        item_fields,
        is_timeline,
    })
}
