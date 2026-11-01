pub use crate::json_helpers::{normalize_embedded_things, normalize_map_record_ids};

/// Helper to check if a surrealdb error indicates a non-existent table/record.
pub fn is_not_found(e: &surrealdb::Error) -> bool {
    e.to_string().contains("does not exist")
}

pub use is_not_found as is_record_not_found;

/// Safely parse a record id string into (table, raw_id) without slice indexing.
pub fn parse_record_id_ref(s: &str) -> Option<(&str, &str)> {
    let (tb, id) = s.split_once(':')?;
    if tb.is_empty()
        || !tb.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        || id.is_empty()
        || s.contains('{')
        || s.contains('\n')
    {
        return None;
    }
    Some((tb, id.trim_matches('`')))
}

/// Extract actual record ID for a target table, returning None if the table prefix mismatches.
pub fn extract_target_id<'a>(table: &str, id: &'a str) -> Option<&'a str> {
    let raw_id = match id.split_once(':') {
        Some((tb, r)) if tb == table => r,
        Some(_) => return None,
        None => id,
    };
    Some(raw_id.trim_matches(|c| matches!(c, '`' | '⟨' | '⟩' | '"' | '\'')))
}
