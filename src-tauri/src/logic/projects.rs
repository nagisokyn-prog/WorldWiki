use serde_json::{json, Value};
use surrealdb::{engine::local::Db, Surreal};

#[tauri::command]
pub async fn get_projects(state: tauri::State<'_, crate::AppState>) -> Result<Vec<Value>, String> {
    get_projects_inner(&state.db).await
}

pub async fn get_projects_inner(db: &Surreal<Db>) -> Result<Vec<Value>, String> {
    let mut res = db
        .query("SELECT *, type::string(id) as id FROM projects")
        .await
        .map_err(|e| e.to_string())?;
    let projects: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(projects)
}

#[tauri::command]
pub async fn create_project(
    project_data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    create_project_inner(&state.db, project_data).await
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

#[tauri::command]
pub async fn get_project_config(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    get_project_config_inner(&state.db, &name).await
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

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    save_project_config_inner(&state.db, &name, config).await
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

#[tauri::command]
pub async fn delete_project(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    delete_project_inner(&state.db, &name).await
}

pub async fn delete_project_inner(
    db: &Surreal<Db>,
    name: &str,
) -> Result<String, String> {
    let pid_raw = name.strip_prefix("projects:").unwrap_or(name).trim_matches('`');
    let pid_val = format!("projects:{}", pid_raw);

    db.query(format!("DELETE FROM entities WHERE project_id = type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;
    db.query(format!("DELETE FROM chapters WHERE project_id = type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;
    db.query(format!("DELETE FROM volumes WHERE project_id = type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;
    db.query(format!("DELETE FROM arcs WHERE project_id = type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;
    db.query(format!("DELETE FROM entity_rel WHERE project_id = type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;
    db.query(format!("DELETE type::record('{pid_val}')")).await.map_err(|e| e.to_string())?;

    Ok(name.to_string())
}