use serde_json::Value;
use tauri::State;
use worldwiki_infrastructure::surrealdb::repos::project_ops_repo;

use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_projects(state: State<'_, AppState>) -> Result<Vec<Value>, IpcError> {
    project_ops_repo::get_projects(&state.services.db)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn create_project(
    project_data: Value,
    state: State<'_, AppState>,
) -> Result<String, IpcError> {
    project_ops_repo::create_project(&state.services.db, project_data)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_project_config(
    name: String,
    state: State<'_, AppState>,
) -> Result<Value, IpcError> {
    project_ops_repo::get_project_config(&state.services.db, &name)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: State<'_, AppState>,
) -> Result<Value, IpcError> {
    project_ops_repo::save_project_config(&state.services.db, &name, config)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_project(name: String, state: State<'_, AppState>) -> Result<String, IpcError> {
    project_ops_repo::delete_project(&state.services.db, &name)
        .await
        .map_err(IpcError::from)
}

#[cfg(feature = "razrab")]
#[tauri::command]
pub async fn execute_raw_surql(
    query: String,
    state: State<'_, AppState>,
) -> Result<Value, IpcError> {
    project_ops_repo::execute_raw_surql(&state.services.db, &query)
        .await
        .map_err(IpcError::from)
}
