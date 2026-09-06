//! IPC layer for module `chapters`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;

#[tauri::command]
pub async fn get_global_timeline(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    get_global_timeline_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn save_global_timeline(
    project: String,
    data: Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    Chapter::save_global_timeline_inner(&state.db, &project, data).await
}

#[tauri::command]
pub async fn save_text_blocks(
    project: String,
    chapter_id: String,
    html: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    save_text_blocks_inner(&state.db, &project, &chapter_id, &html).await
}

#[tauri::command]
pub async fn get_chapter_revisions(
    project: String,
    chapter_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, String> {
    get_chapter_revisions_inner(&state.db, &project, &chapter_id).await
}

#[tauri::command]
pub async fn toggle_chapter_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    toggle_chapter_history_pin_inner(&state.db, &history_id, is_pinned).await
}
