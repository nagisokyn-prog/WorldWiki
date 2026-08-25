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

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- parse_record_id ----------

    #[test]
    fn parses_full_table_key() {
        assert_eq!(
            parse_record_id("chats:abc", "projects"),
            RecordId::new("chats", "abc")
        );
    }

    #[test]
    fn bare_key_uses_default_table() {
        assert_eq!(parse_record_id("p1", "projects"), RecordId::new("projects", "p1"));
    }

    #[test]
    fn strips_backticks_and_angle_decorations() {
        assert_eq!(parse_record_id("`chats:abc`", "projects"), RecordId::new("chats", "abc"));
        assert_eq!(parse_record_id("⟨chats:xyz⟩", "chats"), RecordId::new("chats", "xyz"));
        assert_eq!(parse_record_id("  chats:p_q  ", "chats"), RecordId::new("chats", "p_q"));
    }

    #[test]
    fn decorated_parts_inside_are_cleaned() {
        // Декорации вокруг таблицы и ключа внутри строки тоже снимаются
        assert_eq!(
            parse_record_id("⟨projects⟩:⟨my-project⟩", "chats"),
            RecordId::new("projects", "my-project")
        );
    }

    #[test]
    fn key_with_multiple_colons_keeps_remainder() {
        // Первый ':' отделяет таблицу, остальное — ключ
        assert_eq!(
            parse_record_id("chats:a:b:c", "projects"),
            RecordId::new("chats", "a:b:c")
        );
    }

    // ---------- clean_surreal_id ----------

    #[test]
    fn plain_string_passes_through() {
        assert_eq!(clean_surreal_id(&serde_json::json!("chats:abc")), Some("chats:abc".to_string()));
    }

    #[test]
    fn decorated_string_is_cleaned() {
        assert_eq!(clean_surreal_id(&serde_json::json!("⟨projects:p1⟩")), Some("projects:p1".to_string()));
        assert_eq!(clean_surreal_id(&serde_json::json!("`chats:x`")), Some("chats:x".to_string()));
    }

    #[test]
    fn none_null_and_empty_return_none() {
        assert_eq!(clean_surreal_id(&serde_json::json!("NONE")), None);
        assert_eq!(clean_surreal_id(&serde_json::json!("null")), None);
        assert_eq!(clean_surreal_id(&serde_json::json!("")), None);
        // Пробельная строка НЕ тримится в прод-коде (чистятся только ⟨⟩ и `),
        // поэтому возвращается как есть — документируем это поведение.
        assert_eq!(clean_surreal_id(&serde_json::json!("   ")), Some("   ".to_string()));
    }

    #[test]
    fn object_with_tb_and_string_id() {
        let v = serde_json::json!({ "tb": "chat_messages", "id": { "String": "m1" } });
        assert_eq!(clean_surreal_id(&v), Some("chat_messages:m1".to_string()));
    }

    #[test]
    fn object_with_tb_and_numeric_id() {
        let v = serde_json::json!({ "tb": "chats", "id": { "Number": 42 } });
        assert_eq!(clean_surreal_id(&v), Some("chats:42".to_string()));
    }

    #[test]
    fn object_with_plain_string_id() {
        let v = serde_json::json!({ "tb": "projects", "id": "`proj-1`" });
        assert_eq!(clean_surreal_id(&v), Some("projects:proj-1".to_string()));
    }

    #[test]
    fn object_without_tb_returns_none() {
        let v = serde_json::json!({ "foo": "bar" });
        assert_eq!(clean_surreal_id(&v), None);
    }

    #[test]
    fn non_string_non_object_returns_none() {
        assert_eq!(clean_surreal_id(&serde_json::json!(5)), None);
        assert_eq!(clean_surreal_id(&serde_json::json!(true)), None);
        assert_eq!(clean_surreal_id(&serde_json::Value::Null), None);
        assert_eq!(clean_surreal_id(&serde_json::json!([1, 2])), None);
    }
}
