use serde_json::Value;

fn extract_thing_string(v: &Value) -> Option<String> {
    let tb = v.get("tb")?.as_str()?;
    if tb.is_empty() {
        return None;
    }
    let id_field = v.get("id")?;
    let id_str = id_field.get("String").and_then(|s| s.as_str()).or_else(|| id_field.as_str())?;
    if id_str.is_empty() {
        return None;
    }
    Some(format!("{tb}:{id_str}"))
}

/// Normalize Thing objects (e.g. `{ tb: "...", id: "..." }` or `{ tb: "...", id: { String: "..." } }`) into string ID format in-place.
pub fn normalize_embedded_things(val: &mut Value) {
    let Some(obj) = val.as_object_mut() else { return };
    for v in obj.values_mut() {
        if let Some(thing_str) = extract_thing_string(v) {
            *v = Value::String(thing_str);
        }
    }
}

/// Normalize project_id inside entity map to SurrealDB backtick/bracket format.
pub fn normalize_map_record_ids(map: &mut serde_json::Map<String, Value>) {
    let Some(pid_val) = map.get_mut("project_id") else { return };
    let Some(pid_str) = pid_val.as_str() else { return };
    let clean = pid_str.replace(['⟨', '⟩', '`'], "");
    let actual = clean.strip_prefix("projects:").unwrap_or(&clean);
    if !actual.is_empty() {
        *pid_val = Value::String(format!("projects:⟨{actual}⟩"));
    }
}

