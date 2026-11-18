use serde_json::Value;
use tauri::State;
use worldwiki_infrastructure::surrealdb::repos::connections_repo;

use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_connections(
    project: String,
    chapter: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, IpcError> {
    connections_repo::get_connections(&state.services.db, &project, chapter)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_connections(
    project: String,
    source_id: String,
    data: Value,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    connections_repo::save_connections(&state.services.db, &project, &source_id, data)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn remove_connections_by_source(
    project: String,
    e_type: String,
    e_id: String,
    state: State<'_, AppState>,
) -> Result<usize, IpcError> {
    connections_repo::remove_connections_by_source(&state.services.db, &project, &e_type, &e_id)
        .await
        .map_err(IpcError::from)
}
