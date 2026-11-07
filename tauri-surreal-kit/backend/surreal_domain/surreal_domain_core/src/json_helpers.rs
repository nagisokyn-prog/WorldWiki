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

/// Normalize project_id inside entity map to clean record id format.
pub fn normalize_map_record_ids(map: &mut serde_json::Map<String, Value>) {
    let Some(pid_val) = map.get_mut("project_id") else { return };
    let Some(pid_str) = pid_val.as_str() else { return };
    let clean = pid_str.replace(['⟨', '⟩', '`'], "");
    let actual = clean.strip_prefix("projects:").unwrap_or(&clean);
    if !actual.is_empty() {
        *pid_val = Value::String(format!("projects:{actual}"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_thing_string_and_normalize_embedded_things() {
        // Not an object: should return early without modifying
        let mut non_obj = json!("a string");
        normalize_embedded_things(&mut non_obj);
        assert_eq!(non_obj, json!("a string"));

        let mut non_obj_null = json!(null);
        normalize_embedded_things(&mut non_obj_null);
        assert_eq!(non_obj_null, json!(null));

        // Object with various thing representations
        let mut obj = json!({
            "empty_tb": { "tb": "", "id": "1" },
            "numeric_tb": { "tb": 999, "id": "1" },
            "missing_id": { "tb": "users" },
            "numeric_id": { "tb": "users", "id": 123 },
            "empty_id": { "tb": "users", "id": "" },
            "valid_plain_thing": { "tb": "users", "id": "u1" },
            "valid_nested_thing": { "tb": "projects", "id": { "String": "p1" } },
            "empty_nested_id": { "tb": "projects", "id": { "String": "" } },
            "unrelated_scalar": 42
        });

        normalize_embedded_things(&mut obj);

        assert_eq!(obj["empty_tb"], json!({ "tb": "", "id": "1" }));
        assert_eq!(obj["numeric_tb"], json!({ "tb": 999, "id": "1" }));
        assert_eq!(obj["missing_id"], json!({ "tb": "users" }));
        assert_eq!(obj["numeric_id"], json!({ "tb": "users", "id": 123 }));
        assert_eq!(obj["empty_id"], json!({ "tb": "users", "id": "" }));
        assert_eq!(obj["valid_plain_thing"], json!("users:u1"));
        assert_eq!(obj["valid_nested_thing"], json!("projects:p1"));
        assert_eq!(obj["empty_nested_id"], json!({ "tb": "projects", "id": { "String": "" } }));
        assert_eq!(obj["unrelated_scalar"], json!(42));
    }

    #[test]
    fn test_normalize_map_record_ids() {
        let mut map = serde_json::Map::new();
        // Missing project_id: returns early
        normalize_map_record_ids(&mut map);
        assert!(map.is_empty());

        // Non-string project_id: returns early
        map.insert("project_id".to_string(), json!(12345));
        normalize_map_record_ids(&mut map);
        assert_eq!(map.get("project_id"), Some(&json!(12345)));

        // String project_id that becomes empty after stripping
        map.insert("project_id".to_string(), json!("projects:"));
        normalize_map_record_ids(&mut map);
        assert_eq!(map.get("project_id"), Some(&json!("projects:")));

        map.insert("project_id".to_string(), json!("⟨⟩"));
        normalize_map_record_ids(&mut map);
        assert_eq!(map.get("project_id"), Some(&json!("⟨⟩")));

        // Valid bracketed / raw project_ids
        map.insert("project_id".to_string(), json!("⟨p42⟩"));
        normalize_map_record_ids(&mut map);
        assert_eq!(map.get("project_id"), Some(&json!("projects:p42")));

        map.insert("project_id".to_string(), json!("projects:`p99`"));
        normalize_map_record_ids(&mut map);
        assert_eq!(map.get("project_id"), Some(&json!("projects:p99")));
    }
}

