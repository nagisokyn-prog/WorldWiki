use serde_json::Value;

/// Helper to check if a surrealdb error indicates a non-existent table/record.
pub fn is_not_found(e: &surrealdb::Error) -> bool {
    e.to_string().contains("does not exist")
}

pub use is_not_found as is_record_not_found;

/// Safely parse a record id string into (table, raw_id) without slice indexing.
pub fn parse_record_id_ref(s: &str) -> Option<(&str, &str)> {
    if let Some((tb, id)) = s.split_once(':')
        && !tb.is_empty()
        && tb.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !id.is_empty()
        && !s.contains('{')
        && !s.contains('\n')
    {
        return Some((tb, id.trim_matches('`')));
    }
    None
}

/// Extract actual record ID for a target table, returning None if the table prefix mismatches.
pub fn extract_target_id<'a>(table: &str, id: &'a str) -> Option<&'a str> {
    if let Some((tb, raw_id)) = id.split_once(':') {
        if tb == table {
            Some(raw_id.trim_matches('`'))
        } else {
            None
        }
    } else {
        Some(id.trim_matches('`'))
    }
}

/// Normalize Thing objects (e.g. `{ tb: "...", id: "..." }`) into string ID format in-place.
pub fn normalize_embedded_things(val: &mut Value) {
    if let Some(obj) = val.as_object_mut() {
        for (_k, v) in obj.iter_mut() {
            if v.is_object()
                && let (Some(tb), Some(id_str)) = (
                    v.get("tb").and_then(|t| t.as_str()),
                    v.get("id").and_then(|i| i.as_str()),
                )
                && !tb.is_empty()
                && !id_str.is_empty()
            {
                *v = Value::String(format!("{}:{}", tb, id_str));
            }
        }
    }
}
