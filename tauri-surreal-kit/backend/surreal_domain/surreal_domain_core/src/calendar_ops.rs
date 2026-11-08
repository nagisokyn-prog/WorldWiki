use crate::error::SurrealDomainError;

pub(crate) async fn save_calendar_record<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    cal_id: Option<&str>,
    map: &serde_json::Map<String, serde_json::Value>,
) -> Result<T, SurrealDomainError>
where
    T: serde::de::DeserializeOwned,
{
    let pl_raw = map.get("planet_id").and_then(|v| v.as_str()).unwrap_or("");
    let pl_str = if pl_raw.is_empty() || pl_raw == "NONE" || pl_raw == "planets:NONE" || pl_raw == "earth" || pl_raw == "planets:earth" {
        ""
    } else {
        pl_raw.trim_start_matches("planets:")
    };
    let name_str = map.get("name").and_then(|v| v.as_str()).unwrap_or("Календарь");
    let is_m = map.get("is_master").and_then(|v| v.as_bool()).unwrap_or(false);
    let pid_str = map.get("project_id").and_then(|v| v.as_str()).unwrap_or("default");
    let data_val = map.get("data").cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

    let pl_clause = if pl_str.is_empty() {
        "NONE".to_string()
    } else {
        format!("type::record('planets', '{}')", pl_str)
    };

    let (query, has_cid) = match cal_id {
        Some(cid) => (
            format!("RETURN fn::save_calendar(type::record('calendars', $cal_id), $pid, {}, $name, $is_master, $data);", pl_clause),
            Some(cid.to_string()),
        ),
        None => (
            format!("RETURN fn::save_calendar(NONE, $pid, {}, $name, $is_master, $data);", pl_clause),
            None,
        ),
    };

    let mut q = db.query(&query)
        .bind(("pid", pid_str.to_string()))
        .bind(("name", name_str.to_string()))
        .bind(("is_master", is_m))
        .bind(("data", data_val));

    if let Some(cid) = has_cid {
        q = q.bind(("cal_id", cid));
    }

    let mut res = q.await?;
    let items: Vec<serde_json::Value> = res.take(0)?;
    let val = items
        .into_iter()
        .next()
        .ok_or_else(|| SurrealDomainError::constraint_violation("fn::save_calendar returned no records"))?;
    Ok(serde_json::from_value(val)?)
}

pub(crate) async fn delete_calendar_record<Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    actual_id: &str,
) -> Result<(), SurrealDomainError> {
    let mut res = db
        .query("RETURN fn::delete_calendar(type::record('calendars', $cal_id));")
        .bind(("cal_id", actual_id.to_string()))
        .await?;
    let _ = res.take::<Option<bool>>(0)?;
    Ok(())
}

