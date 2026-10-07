use crate::error::SurrealDomainError;
use crate::id_helpers::is_not_found;

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
