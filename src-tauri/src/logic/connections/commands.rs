//! IPC layer for module `connections`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use serde_json::Value;

#[tauri::command]
pub async fn get_connections(
    project: String,
    chapter: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, ConnectionError> {
    get_connections_inner(&state.db, &project, chapter).await
}

#[tauri::command]
pub async fn save_connections(
    project: String,
    source_id: String,
    data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), ConnectionError> {
    save_connections_inner(&state.db, &project, &source_id, data).await
}

#[tauri::command]
pub async fn remove_connections_by_source(
    project: String,
    e_type: String,
    e_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<usize, ConnectionError> {
    remove_connections_by_source_inner(&state.db, &project, &e_type, &e_id).await
}
