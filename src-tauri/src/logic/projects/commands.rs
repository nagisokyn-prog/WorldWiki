//! IPC layer for module `projects`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use serde_json::Value;

#[tauri::command]
pub async fn get_projects(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, ProjectError> {
    get_projects_inner(&state.db).await
}

#[tauri::command]
pub async fn create_project(
    project_data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, ProjectError> {
    create_project_inner(&state.db, project_data).await
}

#[tauri::command]
pub async fn get_project_config(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, ProjectError> {
    get_project_config_inner(&state.db, &name).await
}

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, ProjectError> {
    save_project_config_inner(&state.db, &name, config).await
}

#[tauri::command]
pub async fn delete_project(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, ProjectError> {
    delete_project_inner(&state.db, &name).await
}
