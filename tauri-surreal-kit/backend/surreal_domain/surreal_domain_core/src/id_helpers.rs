pub use crate::json_helpers::{normalize_embedded_things, normalize_map_record_ids};

/// Helper to check if a surrealdb error indicates a non-existent table/record.
pub fn is_not_found(e: &surrealdb::Error) -> bool {
    let msg = e.to_string();
    if msg.contains("parse") || msg.contains("syntax") || msg.contains("Parse") || msg.contains("Syntax") {
        return false;
    }
    msg.contains("does not exist") || msg.contains("not found") || msg.contains("NotFound")
}

pub use is_not_found as is_record_not_found;

#[path = "id_parse.rs"]
mod id_parse;

pub use id_parse::parse_record_id_ref;

/// Extract actual record ID for a target table, returning None if the table prefix mismatches.
/// Returns Some(raw_id) if and only if the prefix matches the target table.
pub fn extract_target_id<'a>(table: &str, id: &'a str) -> Option<&'a str> {
    let bytes = id.as_bytes();
    let t_bytes = table.as_bytes();
    if bytes.len() <= t_bytes.len() + 1 || bytes.get(t_bytes.len()) != Some(&b':') {
        return None;
    }
    if bytes.get(..t_bytes.len()) != Some(t_bytes) {
        return None;
    }
    let r = id.get(t_bytes.len() + 1..)?;
    let r = r
        .strip_prefix('⟨')
        .or_else(|| r.strip_prefix(['`', '"', '\'']))
        .unwrap_or(r);
    let r = r
        .strip_suffix('⟩')
        .or_else(|| r.strip_suffix(['`', '"', '\'']))
        .unwrap_or(r);
    if r.is_empty() {
        return None;
    }
    Some(r)
}

#[cfg(any(kani, feature = "kani"))]
#[path = "id_helpers_kani.rs"]
pub mod verify;

#[cfg(test)]
#[path = "id_helpers_tests.rs"]
mod tests;
