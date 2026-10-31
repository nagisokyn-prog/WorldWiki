use crate::error::SurrealDomainError;
use crate::id_helpers::is_not_found;

fn normalize_map_record_ids(map: &mut serde_json::Map<String, serde_json::Value>) {
    if let Some(pid_val) = map.get_mut("project_id") {
        if let Some(pid_str) = pid_val.as_str() {
            let clean = pid_str.replace(['⟨', '⟩', '`'], "");
            let actual = clean.strip_prefix("projects:").unwrap_or(&clean);
            if !actual.is_empty() {
                *pid_val = serde_json::Value::String(format!("projects:⟨{}⟩", actual));
            }
        }
    }
}

pub(crate) async fn repo_create<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    mut entity: T,
) -> Result<T, SurrealDomainError>
where
    T: serde::Serialize + serde::de::DeserializeOwned + crate::repo::SurrealRepository,
{
    let val = serde_json::to_value(&entity)?;
    let mut map = match val {
        serde_json::Value::Object(m) => m,
        _ => return Err(SurrealDomainError::invalid_parameter("entity must serialize to a JSON object")),
    };
    map.remove("id");
    map.retain(|_, v| !v.is_null());
    normalize_map_record_ids(&mut map);

    if table == "calendars" {
        let pl_str = map.get("planet_id").and_then(|v| v.as_str()).unwrap_or("earth");
        let name_str = map.get("name").and_then(|v| v.as_str()).unwrap_or("Календарь");
        let is_m = map.get("is_master").and_then(|v| v.as_bool()).unwrap_or(false);
        let pid_str = map.get("project_id").and_then(|v| v.as_str()).unwrap_or("default");
        let data_val = map.get("data").cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        let mut res = db
            .query("RETURN fn::save_calendar(NONE, $pid, $plid, $name, $is_master, $data);")
            .bind(("pid", pid_str.to_string()))
            .bind(("plid", pl_str.to_string()))
            .bind(("name", name_str.to_string()))
            .bind(("is_master", is_m))
            .bind(("data", data_val))
            .await?;
        let items: Vec<serde_json::Value> = res.take(0)?;
        let res_val = items
            .into_iter()
            .next()
            .ok_or_else(|| SurrealDomainError::constraint_violation("fn::save_calendar returned no records"))?;
        let created: T = serde_json::from_value(res_val)?;
        if let Some(id) = created.get_id() {
            entity.set_id(id.to_string());
        }
        return Ok(created);
    }

    let mut res = db
        .query("CREATE type::table($table) CONTENT $data")
        .bind(("table", table.to_string()))
        .bind(("data", serde_json::Value::Object(map)))
        .await?;
    let items: Vec<serde_json::Value> = res.take(0)?;
    let res_val = items
        .into_iter()
        .next()
        .ok_or_else(|| SurrealDomainError::constraint_violation("CREATE returned no records"))?;
    let created: T = serde_json::from_value(res_val)?;
    if let Some(id) = created.get_id() {
        entity.set_id(id.to_string());
    }
    Ok(created)
}

pub(crate) async fn repo_save<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    _fields: &[&str],
    _option_fields: &[&str],
    entity: &T,
) -> Result<T, SurrealDomainError>
where
    T: serde::Serialize + serde::de::DeserializeOwned + crate::repo::SurrealRepository,
{
    if let Some(id_str) = entity.get_id() {
        let actual_id = match id_str.split_once(':') {
            Some((_, aid)) => aid.trim_matches('`'),
            None => id_str.trim_matches('`'),
        };

        let val = serde_json::to_value(entity)?;
        let mut map = match val {
            serde_json::Value::Object(m) => m,
            _ => return Err(SurrealDomainError::invalid_parameter("entity must serialize to a JSON object")),
        };
        map.remove("id");
        normalize_map_record_ids(&mut map);

        if table == "calendars" {
            let pl_str = map.get("planet_id").and_then(|v| v.as_str()).unwrap_or("earth");
            let name_str = map.get("name").and_then(|v| v.as_str()).unwrap_or("Календарь");
            let is_m = map.get("is_master").and_then(|v| v.as_bool()).unwrap_or(false);
            let pid_str = map.get("project_id").and_then(|v| v.as_str()).unwrap_or("default");
            let data_val = map.get("data").cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

            let mut res = db
                .query("RETURN fn::save_calendar(type::record('calendars', $cal_id), $pid, $plid, $name, $is_master, $data);")
                .bind(("cal_id", actual_id.to_string()))
                .bind(("pid", pid_str.to_string()))
                .bind(("plid", pl_str.to_string()))
                .bind(("name", name_str.to_string()))
                .bind(("is_master", is_m))
                .bind(("data", data_val))
                .await?;
            let items: Vec<serde_json::Value> = res.take(0)?;
            let saved_val = items
                .into_iter()
                .next()
                .ok_or_else(|| SurrealDomainError::constraint_violation("fn::save_calendar returned no records"))?;
            return Ok(serde_json::from_value(saved_val)?);
        }

        let mut res = db
            .query("UPSERT $__record_id MERGE $data")
            .bind(("__record_id", surrealdb::types::RecordId::new(table, actual_id)))
            .bind(("data", serde_json::Value::Object(map)))
            .await?;
        let items: Vec<serde_json::Value> = res.take(0)?;
        let saved_val = items
            .into_iter()
            .next()
            .ok_or_else(|| SurrealDomainError::constraint_violation("UPSERT returned no records"))?;
        Ok(serde_json::from_value(saved_val)?)
    } else {
        T::create(db, entity.clone()).await
    }
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
        let mut res = db
            .query("RETURN fn::delete_calendar(type::record('calendars', $cal_id));")
            .bind(("cal_id", actual_id.to_string()))
            .await?;
        let _ = res.take::<Option<bool>>(0)?;
        return Ok(());
    }
    let res: Result<Option<serde_json::Value>, surrealdb::Error> =
        db.delete((table, actual_id)).await;
    match res {
        Ok(_) => Ok(()),
        Err(e) => {
            if is_not_found(&e) {
                Ok(())
            } else {
                Err(SurrealDomainError::from(e))
            }
        }
    }
}
