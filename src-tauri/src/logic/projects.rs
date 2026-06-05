use serde_json::{json, Value};

#[tauri::command]
pub async fn get_projects(state: tauri::State<'_, crate::AppState>) -> Result<Vec<Value>, String> {
    println!("[DEBUG] -> get_projects");
    let mut res = state
        .db
        .query("SELECT *, type::string(id) as id FROM projects")
        .await
        .map_err(|e| e.to_string())?;
    let projects: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    println!("[DEBUG] <- get_projects: returned {} projects", projects.len());
    Ok(projects)
}

#[tauri::command]
pub async fn create_project(
    project_data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    println!("[DEBUG] -> create_project: Received data: {}", project_data);
    let name = project_data["name"].as_str().ok_or("No name")?.to_string();
    let mut data = project_data.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
    }
    state
        .db
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
    println!("[DEBUG] -> get_project_config: Requesting config for project '{}'", name);
    let mut query_res = state
        .db
        .query("SELECT *, type::string(id) as id FROM type::record('projects', $name)")
        .bind(("name", name))
        .await
        .map_err(|e| e.to_string())?;
    let res: Option<Value> = query_res.take(0).map_err(|e: surrealdb::Error| {
        eprintln!("Error in get_project_config take(0): {:?}", e);
        e.to_string()
    })?;
    println!("[DEBUG] <- get_project_config: returned {:?}", res);
    Ok(res.unwrap_or(json!({})))
}

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    println!("[DEBUG] -> save_project_config: Project '{}', Data: {}", name, config);
    let mut data = config.clone();
    if let Some(obj) = data.as_object_mut() {
        obj.remove("id");
    }
    state
        .db
        .update::<Option<Value>>(("projects", name))
        .merge(data)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"success": true}))
}

#[tauri::command]
pub async fn delete_project(name: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let record_id = format!("projects:{}", name);
    state
        .db
        .query("DELETE FROM projects WHERE id = $rid")
        .bind(("rid", record_id))
        .await
        .map_err(|e| e.to_string())?;
    Ok(name)
}