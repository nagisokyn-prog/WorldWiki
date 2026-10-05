use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaHistoryEntry {
    pub id: Option<String>,
    pub schema_id: String,
    pub project_id: String,
    pub snapshot: serde_json::Value,
    pub saved_at: String,
    pub is_pinned: bool,
    pub commit_msg: Option<String>,
}

pub fn flatten_thing(val: &mut Value) {
    if let Some(obj) = val.as_object_mut() {
        for v in obj.values_mut() {
            if v.is_object() {
                let tb_opt = v.get("tb").and_then(|t| t.as_str()).map(|s| s.to_string());
                let id_opt = v.get("id").and_then(|id_field| {
                    id_field
                        .get("String")
                        .and_then(|s| s.as_str())
                        .or_else(|| id_field.as_str())
                        .map(|s| s.to_string())
                });
                if let (Some(tb), Some(id_str)) = (tb_opt, id_opt) {
                    if !tb.is_empty() && !id_str.is_empty() {
                        *v = Value::String(format!("{}:{}", tb, id_str));
                    }
                }
            }
        }
    }
}

pub fn deserialize_list<T: serde::de::DeserializeOwned>(values: Vec<Value>) -> Vec<T> {
    values
        .into_iter()
        .map(|mut v| {
            flatten_thing(&mut v);
            v
        })
        .filter_map(|v| match serde_json::from_value::<T>(v.clone()) {
            Ok(e) => Some(e),
            Err(e) => {
                eprintln!(
                    "[DESERIALIZE ERROR] Failed to parse item of type '{}': {}\nRaw JSON: {:?}",
                    std::any::type_name::<T>(),
                    e,
                    v
                );
                None
            }
        })
        .collect()
}

pub fn safe_pid(p: &str) -> String {
    let p = p.trim().replace("projects:", "");
    if p.is_empty() || p == "undefined" {
        "projects:default".to_string()
    } else {
        format!("projects:{}", p)
    }
}

pub fn safe_id(tb: &str, id: &str) -> String {
    let id = id.trim();
    if id.is_empty() || id == "undefined" {
        format!("{}:default", tb)
    } else if id.starts_with(&format!("{}:", tb)) {
        id.to_string()
    } else {
        format!("{}:{}", tb, id)
    }
}
