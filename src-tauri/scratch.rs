use serde_json::{json, Value};

fn clean_surreal_id(val: &Value) -> Option<String> {
    // If it's a direct string
    if let Some(s) = val.as_str() {
        let cleaned = s.replace('⟨', "").replace('⟩', "").replace('`', "");
        if cleaned == "NONE" || cleaned == "null" || cleaned.is_empty() {
            return None;
        }
        return Some(cleaned);
    }

    // If it's a RecordId serialized as JSON object
    if let Some(obj) = val.as_object() {
        if let Some(tb) = obj.get("tb").and_then(|v| v.as_str()) {
            let id_str = if let Some(id_obj) = obj.get("id").and_then(|v| v.as_object()) {
                if let Some(s) = id_obj.get("String").and_then(|v| v.as_str()) {
                    Some(s.to_string())
                } else if let Some(n) = id_obj.get("Number").and_then(|v| v.as_u64()) {
                    Some(n.to_string())
                } else {
                    None
                }
            } else if let Some(s) = obj.get("id").and_then(|v| v.as_str()) {
                Some(s.to_string())
            } else {
                None
            };
            
            if let Some(id) = id_str {
                let cleaned_id = id.replace('⟨', "").replace('⟩', "").replace('`', "");
                return Some(format!("{}:{}", tb, cleaned_id));
            }
        }
    }
    None
}

fn main() {
    let v1 = json!("chat_messages:`123-456`");
    let v2 = json!({"tb": "chat_messages", "id": {"String": "123-456"}});
    let v3 = json!({"tb": "projects", "id": "proj1"});
    
    println!("v1: {:?}", clean_surreal_id(&v1));
    println!("v2: {:?}", clean_surreal_id(&v2));
    println!("v3: {:?}", clean_surreal_id(&v3));
}
