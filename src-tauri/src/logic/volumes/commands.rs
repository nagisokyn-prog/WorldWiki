//! IPC layer for module `volumes`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    get_chapter_hierarchy_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn create_volume(
    project: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    create_volume_inner(&state.db, &project, &title).await
}

#[tauri::command]
pub async fn update_volume(
    _project: String,
    id: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    update_volume_inner(&state.db, &id, &title).await
}

#[tauri::command]
pub async fn create_arc(
    project: String,
    title: String,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, String> {
    create_arc_inner(&state.db, &project, &title, volume_id).await
}

#[tauri::command]
pub async fn update_arc(
    _project: String,
    id: String,
    title: String,
    _volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    update_arc_inner(&state.db, &id, &title).await
}

#[tauri::command]
pub async fn assign_chapter(
    project: String,
    chapter_id: String,
    arc_id: Option<String>,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    assign_chapter_inner(&state.db, &project, &chapter_id, arc_id, volume_id).await
}

#[tauri::command]
pub async fn reorder_node(
    project: String,
    node_type: String,
    id: String,
    sort_order: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    reorder_node_inner(&state.db, &project, &node_type, &id, sort_order).await
}

