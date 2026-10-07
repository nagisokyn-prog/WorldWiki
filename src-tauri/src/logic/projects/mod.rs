use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};

pub mod commands;
pub mod errors;

pub use commands::*;
pub use errors::*;

pub async fn get_projects_inner(db: &Surreal<Db>) -> Result<Vec<Value>, ProjectError> {
    let mut res = db
        .query("RETURN fn::get_projects_list();")
        .await?;
    let projects: Vec<Value> = res.take(0).unwrap_or_default();
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

pub async fn execute_raw_surql_inner(
    db: &Surreal<Db>,
    query: &str,
) -> Result<Value, ProjectError> {
    let mut res = db
        .query(query)
        .await
        .map_err(|e| ProjectError::InvalidData(e.to_string()))?;

    let mut results: Vec<Value> = Vec::new();
    let mut idx: usize = 0;
    while let Ok(Some(val)) = res.take::<Option<Value>>(idx) {
        results.push(val);
        idx += 1;
    }

    if results.is_empty() {
        Ok(Value::Array(vec![]))
    } else if results.len() == 1 {
        Ok(results.remove(0))
    } else {
        Ok(Value::Array(results))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_error_formatting_and_conversion() {
        let not_found = ProjectError::NotFound("proj1".to_string());
        assert_eq!(not_found.to_string(), "Project not found: proj1");

        let err_str: String = not_found.into();
        assert_eq!(err_str, "Project not found: proj1");

        let inv = ProjectError::InvalidData("no name".to_string());
        assert_eq!(inv.to_string(), "Invalid project data: no name");
    }

    #[tokio::test]
    async fn test_execute_raw_surql_inner() {
        use surrealdb::engine::local::Mem;
        let db = Surreal::new::<Mem>(()).await.expect("in-memory db");
        db.use_ns("test").use_db("test").await.expect("use ns/db");

        let res = execute_raw_surql_inner(&db, "RETURN 1 + 1;").await.expect("exec raw surql");
        assert_eq!(res, serde_json::json!(2));

        let res_multi = execute_raw_surql_inner(&db, "RETURN 'a'; RETURN 'b';").await.expect("exec raw surql multi");
        assert_eq!(res_multi, serde_json::json!(["a", "b"]));
    }
}

