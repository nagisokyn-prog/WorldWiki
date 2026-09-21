//! IPC layer for module `projects`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;

#[tauri::command]
pub async fn get_projects(state: tauri::State<'_, crate::AppState>) -> Result<Vec<Value>, String> {
    get_projects_inner(&state.db).await.map_err(Into::into)
}

#[tauri::command]
pub async fn create_project(
    project_data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    create_project_inner(&state.db, project_data)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_project_config(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    get_project_config_inner(&state.db, &name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    save_project_config_inner(&state.db, &name, config)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn delete_project(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    delete_project_inner(&state.db, &name)
        .await
        .map_err(Into::into)
}

