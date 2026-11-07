use crate::error::SurrealDomainError;
use crate::id_helpers::{extract_target_id, is_not_found, normalize_embedded_things};

pub(crate) async fn repo_find_by_id<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    id: &str,
) -> Result<Option<T>, SurrealDomainError>
where
    T: serde::de::DeserializeOwned,
{
    let actual_id = if id.contains(':') {
        match extract_target_id(table, id) {
            Some(aid) => aid,
            None => return Ok(None),
        }
    } else {
        id.strip_prefix('⟨')
            .or_else(|| id.strip_prefix(['`', '"', '\'']))
            .unwrap_or(id)
            .strip_suffix('⟩')
            .or_else(|| id.strip_suffix(['`', '"', '\'']))
            .unwrap_or(id)
    };
    match db.select((table, actual_id)).await {
        Ok(res) => Ok(res.and_then(|mut v| {
            normalize_embedded_things(&mut v);
            serde_json::from_value(v).ok()
        })),
        Err(e) => {
            if is_not_found(&e) {
                Ok(None)
            } else {
                Err(SurrealDomainError::from(e))
            }
        }
    }
}

pub(crate) async fn repo_find_all<T, Db: surrealdb::Connection>(
    db: &surrealdb::Surreal<Db>,
    table: &'static str,
    project_id: &str,
) -> Result<Vec<T>, SurrealDomainError>
where
    T: serde::de::DeserializeOwned,
{
    let clean = project_id.replace(['⟨', '⟩', '`'], "");
    let pid_raw = match clean.split_once(':') {
        Some((_, raw)) => raw,
        None => &clean,
    };
    let pid_str = format!("projects:{}", pid_raw);
    let pid_bracketed = format!("projects:⟨{}⟩", pid_raw);
    let pid_backticked = format!("projects:`{}`", pid_raw);

    let query_str = match table {
        "chapters" => "SELECT * FROM chapters WHERE volume_id.project_id = $pid OR volume_id.project_id = $pid_str OR volume_id.project_id = $pid_bracketed OR volume_id.project_id = $pid_raw".to_string(),
        "entities" => "SELECT * FROM entities WHERE schema_id.project_id = $pid OR schema_id.project_id = $pid_str OR schema_id.project_id = $pid_bracketed OR schema_id.project_id = $pid_raw".to_string(),
        "calendars" => "SELECT * FROM calendars WHERE planet_id.project_id = $pid OR planet_id.project_id = $pid_str OR planet_id.project_id = $pid_bracketed OR planet_id.project_id = $pid_raw".to_string(),
        "text_blocks" => "SELECT * FROM text_blocks WHERE chapter_id.volume_id.project_id = $pid OR chapter_id.volume_id.project_id = $pid_str OR chapter_id.volume_id.project_id = $pid_bracketed OR chapter_id.volume_id.project_id = $pid_raw".to_string(),
        _ => format!("SELECT * FROM {table} WHERE project_id = $pid OR project_id = $pid_str OR project_id = $pid_bracketed OR project_id = $pid_raw"),
    };

    let mut res = db
        .query(&query_str)
        .bind(("pid", surrealdb::types::RecordId::new("projects", pid_raw)))
        .bind(("pid_str", pid_str))
        .bind(("pid_bracketed", pid_bracketed))
        .bind(("pid_backticked", pid_backticked))
        .bind(("pid_raw", pid_raw.to_string()))
        .await?;

    let entities: Vec<serde_json::Value> = match res.take(0) {
        Ok(entities) => entities,
        Err(ref e) if is_not_found(e) => Vec::new(),
        Err(e) => return Err(SurrealDomainError::from(e)),
    };

    let mapped = entities
        .into_iter()
        .filter_map(|mut v| {
            normalize_embedded_things(&mut v);
            match serde_json::from_value::<T>(v.clone()) {
                Ok(item) => Some(item),
                Err(err) => {
                    eprintln!("[SURREAL DESERIALIZE ERROR] Table '{}' item failed: {}\nItem JSON: {:?}", table, err, v);
                    None
                }
            }
        })
        .collect();
    Ok(mapped)
}
