use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};

mod commands;
pub use commands::*;

pub async fn get_projects_inner(db: &Surreal<Db>) -> Result<Vec<Value>, String> {
    let mut res = db
        .query("SELECT *, type::string(id) as id FROM projects")
        .await
        .map_err(|e| e.to_string())?;
    let projects: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(projects)
}

pub async fn create_project_inner(
    db: &Surreal<Db>,
    project_data: Value,
) -> Result<String, String> {
    let name = project_data["name"].as_str().ok_or("No name")?.to_string();
    let mut data = project_data.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
        if !obj.contains_key("data") {
            obj.insert("data".to_string(), json!({}));
        }
    }
    db
        .upsert::<Option<Value>>(("projects", name.clone()))
        .content(data)
        .await
        .map_err(|e| e.to_string())?;
    Ok(name)
}

pub async fn get_project_config_inner(
    db: &Surreal<Db>,
    name: &str,
) -> Result<Value, String> {
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
        .await
        .map_err(|e| e.to_string())?;
    let res: Option<Value> = query_res.take(0).map_err(|e: surrealdb::Error| {
        e.to_string()
    })?;
    Ok(res.unwrap_or(json!({})))
}

pub async fn save_project_config_inner(
    db: &Surreal<Db>,
    name: &str,
    config: Value,
) -> Result<Value, String> {
    let mut data = config.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
    }
    db
        .update::<Option<Value>>(("projects", name))
        .merge(data)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"success": true}))
}

pub async fn delete_project_inner(
    db: &Surreal<Db>,
    name: &str,
) -> Result<String, String> {
    let pid_raw = name.strip_prefix("projects:").unwrap_or(name).trim_matches('`');
    let pid_val = format!("projects:{}", pid_raw);

    let mut retries = 5;
    while retries > 0 {
        let mut res = db.query("DELETE projects WHERE id = type::record('projects', $p) OR id = $pid")
            .bind(("p", pid_raw))
            .bind(("pid", pid_val.clone()))
            .await
            .map_err(|e| e.to_string())?;

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

        eprintln!("[DELETE_PROJECT_ERROR] {:?}", errors);
        return Err(format!("{:?}", errors));
    }

    Ok(name.to_string())
}
