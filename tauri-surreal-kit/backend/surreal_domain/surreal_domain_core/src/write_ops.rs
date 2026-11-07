use crate::bind_helpers::{bind_map_values, bind_tuple_values, build_upsert_clauses};
use crate::calendar_ops::{delete_calendar_record, save_calendar_record};
use crate::error::SurrealDomainError;
use crate::id_helpers::{is_not_found, normalize_embedded_things, normalize_map_record_ids};

pub(crate) async fn repo_create<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    mut entity: T,
) -> Result<T, SurrealDomainError>
where
    T: serde::Serialize + serde::de::DeserializeOwned + crate::repo::SurrealRepository,
{
    let val = serde_json::to_value(&entity)?;
    let serde_json::Value::Object(mut map) = val else {
        return Err(SurrealDomainError::invalid_parameter("entity must serialize to a JSON object"));
    };
    map.remove("id");
    map.retain(|_, v| !v.is_null());
    normalize_map_record_ids(&mut map);

    if table == "calendars" {
        let created: T = save_calendar_record(db, None, &map).await?;
        if let Some(id) = created.get_id() {
            entity.set_id(id.to_string());
        }
        return Ok(created);
    }

    let assign_clauses: Vec<String> = map.keys().map(|k| format!("{k} = ${k}")).collect();
    let query_str = if assign_clauses.is_empty() {
        format!("CREATE {table}")
    } else {
        format!("CREATE {table} SET {}", assign_clauses.join(", "))
    };

    let q = bind_map_values(db.query(&query_str), map);
    let mut res = q.await?;
    let items: Vec<serde_json::Value> = res.take(0)?;
    let mut res_val = items
        .into_iter()
        .next()
        .ok_or_else(|| SurrealDomainError::constraint_violation("CREATE returned no records"))?;
    normalize_embedded_things(&mut res_val);
    let created: T = serde_json::from_value(res_val)?;
    if let Some(id) = created.get_id() {
        entity.set_id(id.to_string());
    }
    Ok(created)
}

pub(crate) async fn repo_save<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    fields: &[&str],
    option_fields: &[&str],
    entity: &T,
) -> Result<T, SurrealDomainError>
where
    T: serde::Serialize + serde::de::DeserializeOwned + crate::repo::SurrealRepository,
{
    let Some(id_str) = entity.get_id() else {
        return T::create(db, entity.clone()).await;
    };

    let actual_id = match id_str.split_once(':') {
        Some((_, aid)) => aid.trim_matches('`'),
        None => id_str.trim_matches('`'),
    };

    let val = serde_json::to_value(entity)?;
    let serde_json::Value::Object(mut map) = val else {
        return Err(SurrealDomainError::invalid_parameter("entity must serialize to a JSON object"));
    };
    map.remove("id");
    normalize_map_record_ids(&mut map);

    if table == "calendars" {
        return save_calendar_record(db, Some(actual_id), &map).await;
    }

    let (assign_clauses, bind_values) = build_upsert_clauses(fields, option_fields, map);
    let set_clause = if assign_clauses.is_empty() {
        String::new()
    } else {
        format!(" SET {}", assign_clauses.join(", "))
    };
    let query_str = format!("UPSERT type::record($__tb, $__id){set_clause}");
    let q = db
        .query(&query_str)
        .bind(("__tb", table.to_string()))
        .bind(("__id", actual_id.to_string()));
    let mut res = bind_tuple_values(q, bind_values).await?;
    let items: Vec<serde_json::Value> = res.take(0)?;
    let Some(mut saved_val) = items.into_iter().next() else {
        return T::create(db, entity.clone()).await;
    };
    normalize_embedded_things(&mut saved_val);
    Ok(serde_json::from_value(saved_val)?)
}

pub(crate) async fn repo_delete<Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    id: &str,
) -> Result<(), SurrealDomainError> {
    let actual_id = match id.split_once(':') {
        Some((tb, raw_id)) => {
            if tb != table {
                return Ok(());
            }
            raw_id.trim_matches('`')
        }
        None => id.trim_matches('`'),
    };
    if table == "calendars" {
        return delete_calendar_record(db, actual_id).await;
    }
    let res: Result<Option<serde_json::Value>, surrealdb::Error> =
        db.delete((table, actual_id)).await;
    match res {
        Ok(_) => Ok(()),
        Err(e) if is_not_found(&e) => Ok(()),
        Err(e) => Err(SurrealDomainError::from(e)),
    }
}
