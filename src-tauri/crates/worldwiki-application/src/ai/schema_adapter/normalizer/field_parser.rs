use serde_json::Value;
use worldwiki_domain::knowledge::NormalizedFieldDef;

pub(crate) fn parse_field_def(f: &Value) -> Option<NormalizedFieldDef> {
    let key = f
        .get("path")
        .or_else(|| f.get("class"))
        .or_else(|| f.get("id"))
        .or_else(|| f.get("key"))
        .and_then(|v| v.as_str())?
        .to_string();

    let label = f
        .get("label")
        .and_then(|v| v.as_str())
        .unwrap_or(&key)
        .to_string();

    let raw_type = f
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("text");

    let field_type = match raw_type {
        "textarea" => "textarea",
        "number" => "number",
        "range" => "range",
        "boolean" | "toggle" | "checkbox" => "boolean",
        "select" => "select",
        "multi_select" => "multi_select",
        "calendar_datetime" | "date" => "calendar_date",
        "tags" => "tags",
        _ => {
            if f.get("entityType").is_some() {
                "entity_ref"
            } else {
                "text"
            }
        }
    }
    .to_string();

    let required = f.get("required").and_then(|v| v.as_bool()).unwrap_or(false);

    let mut options = Vec::new();
    if let Some(opts) = f.get("options").and_then(|v| v.as_array()) {
        for opt in opts {
            if let Some(s) = opt.as_str() {
                options.push(s.to_string());
            } else if let Some(val) = opt.get("value").and_then(|v| v.as_str()) {
                options.push(val.to_string());
            }
        }
    }

    let entity_type_ref = f
        .get("entityType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let description = f
        .get("placeholder")
        .or_else(|| f.get("description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let default_value = f.get("default").or_else(|| f.get("defaultValue")).cloned();

    Some(NormalizedFieldDef {
        key,
        label,
        field_type,
        required,
        options,
        entity_type_ref,
        description,
        default_value,
    })
}
