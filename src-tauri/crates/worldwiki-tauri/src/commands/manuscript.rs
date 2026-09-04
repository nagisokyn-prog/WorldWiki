use tauri::State;
use worldwiki_domain::manuscript::Chapter;
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_chapter(
    state: State<'_, AppState>,
    chapter_id: String,
) -> Result<Chapter, IpcError> {
    state
        .services
        .manuscript
        .get_chapter(&chapter_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_chapter(
    state: State<'_, AppState>,
    chapter: Chapter,
) -> Result<(), IpcError> {
    state
        .services
        .manuscript
        .save_chapter(&chapter)
        .await
        .map_err(IpcError::from)
}
