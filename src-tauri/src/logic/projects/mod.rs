use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};

pub mod commands;
pub mod errors;

pub use commands::*;
pub use errors::*;

pub async fn get_projects_inner(db: &Surreal<Db>) -> Result<Vec<Value>, ProjectError> {
    let mut res = db
        .query("SELECT *, type::string(id) as id FROM projects")
        .await?;
    let projects: Vec<Value> = res.take(0)?;
    Ok(projects)
}

pub async fn create_project_inner(
    db: &Surreal<Db>,
    project_data: Value,
) -> Result<String, ProjectError> {
    let name = project_data["name"]
        .as_str()
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
    let pid_val = if name.is_empty() || name == "undefined" {
        "projects:default".to_string()
    } else if name.starts_with("projects:") {
        name.to_string()
    } else {
        format!("projects:{}", name)
    };
    let pid_raw = pid_val.replace("projects:", "");
    let pid_literal = format!("projects:`{}`", pid_raw);
    let mut query_res = db
        .query(format!("SELECT *, type::string(id) as id FROM {}", pid_literal))
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
    let pid_raw = name.strip_prefix("projects:").unwrap_or(name).trim_matches('`');
    let pid_val = format!("projects:{}", pid_raw);

    let mut retries = 5;
    while retries > 0 {
        let mut res = db
            .query("DELETE projects WHERE id = type::record('projects', $p) OR id = $pid")
            .bind(("p", pid_raw))
            .bind(("pid", pid_val.clone()))
            .await?;

        let errors = res.take_errors();
        if errors.is_empty() {
            return Ok(name.to_string());
        }

        let is_conflict = errors.values().any(|e| {
            let msg = format!("{:?}", e);
            msg.contains("Transaction conflict") || msg.contains("Transaction write conflict")
        });

        if is_conflict && retries > 1 {
            retries -= 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            continue;
        }

        return Err(ProjectError::Transaction(format!("{:?}", errors)));
    }

    Ok(name.to_string())
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
}

