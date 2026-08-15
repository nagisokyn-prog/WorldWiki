pub mod tree;
pub mod operations;

use serde_json::Value;
use surrealdb::types::RecordId;

pub fn parse_record_id(id: &str, default_table: &str) -> RecordId {
    let clean = id.trim().trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
    if let Some(colon) = clean.find(':') {
        let table = clean[..colon]
            .trim()
            .trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
        let key = clean[colon + 1..]
            .trim()
            .trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
        RecordId::new(table, key)
    } else {
        RecordId::new(default_table, clean)
    }
}

pub fn clean_surreal_id(val: &Value) -> Option<String> {
    if let Some(s) = val.as_str() {
        let cleaned = s.replace(['⟨', '⟩', '`'], "");
        if cleaned == "NONE" || cleaned == "null" || cleaned.is_empty() {
            return None;
        }
        return Some(cleaned);
    }

    if let Some(obj) = val.as_object() {
        if let Some(tb) = obj.get("tb").and_then(|v| v.as_str()) {
            let id_str = if let Some(id_obj) = obj.get("id").and_then(|v| v.as_object()) {
                if let Some(s) = id_obj.get("String").and_then(|v| v.as_str()) {
                    Some(s.to_string())
                } else { id_obj.get("Number").and_then(|v| v.as_u64()).map(|n| n.to_string()) }
            } else { obj.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()) };
            
            if let Some(id) = id_str {
                let cleaned_id = id.replace(['⟨', '⟩', '`'], "");
                return Some(format!("{}:{}", tb, cleaned_id));
            }
        }
    }
    None
}
