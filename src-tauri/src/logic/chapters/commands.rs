//! IPC layer for module `chapters`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::logic::models::Chapter;

#[tauri::command]
pub async fn get_chapters(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Chapter>, ChapterError> {
    get_chapters_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn get_chapter(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Option<Chapter>, ChapterError> {
    get_chapter_inner(&state.db, &id).await
}

#[tauri::command]
pub async fn create_chapter(
    project: String,
    chapter: Chapter,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Chapter, ChapterError> {
    create_chapter_inner(&state.db, &project, chapter).await
}

#[tauri::command]
pub async fn save_chapter(
    chapter: Chapter,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Chapter, ChapterError> {
    save_chapter_inner(&state.db, chapter).await
}

#[tauri::command]
pub async fn delete_chapter(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), ChapterError> {
    delete_chapter_inner(&state.db, &id).await
}

#[tauri::command]
pub async fn get_global_timeline(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    get_global_timeline_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn save_global_timeline(
    project: String,
    data: serde_json::Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    save_global_timeline_inner(&state.db, &project, data).await
}

#[tauri::command]
pub async fn save_text_blocks(
    project: String,
    chapter_id: String,
    html: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), ChapterError> {
    save_text_blocks_inner(&state.db, &project, &chapter_id, &html).await
}

#[tauri::command]
pub async fn get_chapter_revisions(
    project: String,
    chapter_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<serde_json::Value>, ChapterError> {
    get_chapter_revisions_inner(&state.db, &project, &chapter_id).await
}

#[tauri::command]
pub async fn toggle_chapter_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), ChapterError> {
    toggle_chapter_history_pin_inner(&state.db, &history_id, is_pinned).await
}

#[tauri::command]
pub async fn get_planet_calendar_bundle(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    get_planet_calendar_bundle_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn save_planet(
    params: SavePlanetParams,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    save_planet_inner(&state.db, params).await
}

#[tauri::command]
pub async fn save_calendar_direct(
    project: String,
    calendar_id: Option<String>,
    planet_id: String,
    name: String,
    is_master: bool,
    data: serde_json::Value,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    save_calendar_inner(
        &state.db,
        &project,
        calendar_id,
        &planet_id,
        &name,
        is_master,
        data,
    )
    .await
}

#[tauri::command]
pub async fn set_master_calendar(
    project: String,
    planet_id: String,
    calendar_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    set_master_calendar_inner(&state.db, &project, &planet_id, &calendar_id).await
}

#[tauri::command]
pub async fn delete_planet(
    project: String,
    planet_id: String,
    cascade: Option<bool>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    delete_planet_inner(&state.db, &project, &planet_id, cascade.unwrap_or(true)).await
}

#[tauri::command]
pub async fn delete_calendar_direct(
    calendar_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<serde_json::Value, ChapterError> {
    delete_calendar_inner(&state.db, &calendar_id).await
}
