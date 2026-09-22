//! Record ID sanitization and table prefix enforcement for SurrealDB entities.

/// Cleans raw ID from quotes, backticks, brackets and ensures proper table prefix.
pub fn clean_record_id(default_table: &str, raw: &str) -> String {
    let trimmed = raw.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
    if trimmed.is_empty() {
        return String::new();
    }
    if let Some((tbl, id_part)) = trimmed.split_once(':') {
        let clean_id = id_part.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
        format!("{}:{}", tbl.trim(), clean_id)
    } else {
        format!("{}:{}", default_table, trimmed)
    }
}
