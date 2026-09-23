//! Helper functions for SurrealDB queries, ID normalization, fuzzy matching, and result extraction.

use serde_json::Value;
use surrealdb::IndexedResults;
use worldwiki_domain::errors::DomainError;

/// Helper to sanitize record IDs (ensures table prefix handling)
pub fn clean_id(table: &str, raw_id: &str) -> String {
    if raw_id.contains(':') {
        raw_id.to_string()
    } else {
        format!("{table}:{raw_id}")
    }
}

pub use super::fuzzy::{canonicalize_name, fuzzy_match_name, levenshtein_distance};

/// Universal helper to construct a project_id WHERE clause that matches
/// RecordId, raw string, and cleaned string representations in SurrealDB.
#[inline]
pub fn project_where_clause(field: &str) -> String {
    format!(
        "({field} = type::record('projects', $p_clean) OR {field} = $p_raw OR {field} = $p_clean OR {field} = type::record('projects', $p_raw))"
    )
}

pub fn prepare_data_for_upsert(mut data: Value) -> Value {
    if let Value::Object(ref mut map) = data {
        map.remove("id");
    }
    data
}

pub fn normalize_surreal_value(val: &mut Value) {
    if let Value::Object(map) = val {
        for (_k, v) in map.iter_mut() {
            if let Value::Object(inner) = v {
                if let (Some(Value::String(tb)), Some(id_val)) = (inner.get("tb"), inner.get("id"))
                {
                    let id_str = match id_val {
                        Value::String(s) => s.clone(),
                        _ => id_val.to_string().trim_matches('"').to_string(),
                    };
                    *v = Value::String(format!("{tb}:{id_str}"));
                } else {
                    normalize_surreal_value(v);
                }
            } else if let Value::Array(arr) = v {
                for item in arr {
                    normalize_surreal_value(item);
                }
            }
        }
    }
}

pub fn take_one<T: serde::de::DeserializeOwned>(
    res: &mut IndexedResults,
    idx: usize,
) -> Result<Option<T>, DomainError> {
    let raw: Option<Value> = res
        .take(idx)
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    match raw {
        Some(mut val) => {
            normalize_surreal_value(&mut val);
            let item: T =
                serde_json::from_value(val).map_err(|e| DomainError::Validation(e.to_string()))?;
            Ok(Some(item))
        }
        None => Ok(None),
    }
}

pub fn take_list<T: serde::de::DeserializeOwned>(
    res: &mut IndexedResults,
    idx: usize,
) -> Result<Vec<T>, DomainError> {
    let raw: Vec<Value> = res
        .take(idx)
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    let mut list = Vec::with_capacity(raw.len());
    for mut val in raw {
        normalize_surreal_value(&mut val);
        let item: T =
            serde_json::from_value(val).map_err(|e| DomainError::Validation(e.to_string()))?;
        list.push(item);
    }
    Ok(list)
}
