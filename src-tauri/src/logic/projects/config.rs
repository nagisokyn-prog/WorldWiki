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
    }
    db.update::<Option<Value>>(("projects", name))
        .merge(data)
        .await?;
    Ok(json!({"success": true}))
}
