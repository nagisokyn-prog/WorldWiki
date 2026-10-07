use crate::id_helpers::parse_record_id_ref;
use serde_json::Value;
use std::collections::HashSet;

/// Bind map parameters into a surrealdb Query, converting record id strings to SurrealDB RecordIds.
pub fn bind_map_values<Db: surrealdb::Connection>(
    mut query: surrealdb::method::Query<'_, Db>,
    map: impl IntoIterator<Item = (String, Value)>,
) -> surrealdb::method::Query<'_, Db> {
    for (k, v) in map {
        if let Some(s) = v.as_str() {
            if let Some((tb, raw_id)) = parse_record_id_ref(s) {
                query = query.bind((k, surrealdb::types::RecordId::new(tb, raw_id)));
            } else {
                query = query.bind((k, v));
            }
        } else {
            query = query.bind((k, v));
        }
    }
    query
}

/// Bind slice of (String, Value) tuples into a surrealdb Query.
pub fn bind_tuple_values<Db: surrealdb::Connection>(
    mut query: surrealdb::method::Query<'_, Db>,
    tuples: impl IntoIterator<Item = (String, Value)>,
) -> surrealdb::method::Query<'_, Db> {
    for (k, v) in tuples {
        if let Some(s) = v.as_str() {
            if let Some((tb, raw_id)) = parse_record_id_ref(s) {
                query = query.bind((k, surrealdb::types::RecordId::new(tb, raw_id)));
            } else {
                query = query.bind((k, v));
            }
        } else {
            query = query.bind((k, v));
        }
    }
    query
}

/// Build assignment clauses and bind values for UPSERT queries.
pub fn build_upsert_clauses(
    fields: &[&str],
    option_fields_slice: &[&str],
    map: serde_json::Map<String, Value>,
) -> (Vec<String>, Vec<(String, Value)>) {
    let mut assign_clauses = Vec::new();
    let mut bind_values = Vec::new();
    let option_fields: HashSet<&str> = option_fields_slice.iter().copied().collect();

    for &field_name in fields {
        if field_name != "id" && !map.contains_key(field_name) {
            let literal = if option_fields.contains(field_name) {
                "NONE"
            } else {
                "null"
            };
            assign_clauses.push(format!("{} = {}", field_name, literal));
        }
    }

    for (key, v) in map {
        if v.is_null() {
            let literal = if option_fields.contains(key.as_str()) {
                "NONE"
            } else {
                "null"
            };
            assign_clauses.push(format!("{} = {}", key, literal));
        } else {
            assign_clauses.push(format!("{} = ${}", key, key));
            bind_values.push((key, v));
        }
    }

    (assign_clauses, bind_values)
}
