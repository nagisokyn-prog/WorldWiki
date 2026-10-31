use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};
use crate::logic::projects::errors::ProjectError;

pub async fn get_project_config_inner(
    db: &Surreal<Db>,
    name: &str,
) -> Result<Value, ProjectError> {
    let mut query_res = db
        .query("RETURN fn::get_project_config($name);")
        .bind(("name", name.to_string()))
        .await?;
    let res: Option<Value> = query_res.take(0)?;
    Ok(res.unwrap_or(json!({})))
}

pub async fn save_project_config_inner(
    db: &Surreal<Db>,
    name: &str,
    config: Value,
) -> Result<Value, ProjectError> {
    let mut data = config.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
        obj.remove("data");
        obj.remove("perfLevel");
    }
    let clean_name = name.trim().trim_start_matches("projects:").trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');

    // Находим реальный record ID проекта (по id или по полю name)
    let find_sql = "SELECT type::string(id) AS id FROM projects WHERE id = fn::normalize_project_id($name) OR name = $name LIMIT 1;";
    let mut find_res = db.query(find_sql).bind(("name", clean_name.to_string())).await?;
    let found: Option<Value> = find_res.take(0)?;

    let target_rec = if let Some(f) = found {
        f.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())
    } else {
        None
    };

    let Some(rec_str) = target_rec else {
        eprintln!("[PROJECT CONFIG] Project '{}' not found for update", name);
        return Err(ProjectError::NotFound(name.to_string()));
    };

    let rec_id = rec_str.trim_start_matches("projects:").trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');

    let update_res: Option<Value> = db.update(("projects", rec_id))
        .merge(data)
        .await?;

    if update_res.is_none() {
        eprintln!("[PROJECT CONFIG] Project update yielded 0 records for id '{}'", rec_id);
        return Err(ProjectError::NotFound(name.to_string()));
    }

    Ok(json!({"success": true}))
}
