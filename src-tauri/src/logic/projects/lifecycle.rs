use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};
use crate::logic::projects::errors::ProjectError;

pub async fn get_projects_inner(db: &Surreal<Db>) -> Result<Vec<Value>, ProjectError> {
    let mut res = db
        .query("RETURN fn::get_projects_list();")
        .await?;
    let projects: Vec<Value> = res.take(0)?;
    Ok(projects)
}

pub async fn create_project_inner(
    db: &Surreal<Db>,
    project_data: Value,
) -> Result<String, ProjectError> {
    let name = project_data
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ProjectError::InvalidData("No name provided".to_string()))?
        .to_string();
    let mut data = project_data.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
        if !obj.contains_key("data") {
            obj.insert("data".to_string(), json!({}));
        }
    }
    db.upsert::<Option<Value>>(("projects", name.clone()))
        .content(data)
        .await?;
    Ok(name)
}

pub async fn delete_project_inner(
    db: &Surreal<Db>,
    name: &str,
) -> Result<String, ProjectError> {
    let mut attempts = 0;
    loop {
        let query_res = db
            .query("RETURN fn::delete_project_cascade($name);")
            .bind(("name", name.to_string()))
            .await;

        match query_res {
            Ok(mut res) => match res.take::<Option<Value>>(0) {
                Ok(_) => return Ok(name.to_string()),
                Err(e) => {
                    let err_str = e.to_string();
                    if attempts < 15
                        && (err_str.contains("Transaction conflict")
                            || err_str.contains("can be retried")
                            || err_str.contains("TransactionConflict")
                            || err_str.contains("try again"))
                    {
                        attempts += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * attempts))
                            .await;
                        continue;
                    }
                    return Err(ProjectError::from(e));
                }
            },
            Err(e) => {
                let err_str = e.to_string();
                if attempts < 15
                    && (err_str.contains("Transaction conflict")
                        || err_str.contains("can be retried")
                        || err_str.contains("TransactionConflict")
                        || err_str.contains("try again"))
                {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(100 * attempts)).await;
                    continue;
                }
                return Err(ProjectError::from(e));
            }
        }
    }
}
