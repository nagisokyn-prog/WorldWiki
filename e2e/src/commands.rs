//! Commands implementation for E2E headless tests
//! Scanned by #[tauri_test::setup] to generate the N-API invoke dispatcher.

use serde_json::{json, Value};
use tauri::State;
use world_wiki::bootstrap::lifecycle::AppState;
use world_wiki::logic::models::Chapter;

#[tauri::command]
pub async fn create_project(
    name: Option<String>,
    project_data: Option<Value>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let payload = if let Some(n) = name {
        json!({ "name": n })
    } else if let Some(data) = project_data {
        data
    } else {
        json!({})
    };
    world_wiki::logic::projects::create_project_inner(&state.db, payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_projects(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    world_wiki::logic::projects::get_projects_inner(&state.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project_config(
    name: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    world_wiki::logic::projects::get_project_config_inner(&state.db, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_project_config(
    name: String,
    config: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    world_wiki::logic::projects::save_project_config_inner(&state.db, &name, config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_project(
    name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    world_wiki::logic::projects::delete_project_inner(&state.db, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_volume(
    project: Option<String>,
    project_id: Option<String>,
    title: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let proj = project.or(project_id).unwrap_or_default();
    world_wiki::logic::volumes::create_volume_inner(&state.db, &proj, &title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: Option<String>,
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let proj = project.or(project_id).unwrap_or_default();
    world_wiki::logic::volumes::get_chapter_hierarchy_inner(&state.db, &proj)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chapters(
    project: Option<String>,
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Chapter>, String> {
    let proj = project.or(project_id).unwrap_or_default();
    world_wiki::logic::chapters::get_chapters_inner(&state.db, &proj)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_chapter(
    project: Option<String>,
    project_id: Option<String>,
    title: Option<String>,
    content: Option<String>,
    chapter: Option<Chapter>,
    state: State<'_, AppState>,
) -> Result<Chapter, String> {
    let proj = project.or(project_id).unwrap_or_default();
    let chap = if let Some(c) = chapter {
        c
    } else {
        serde_json::from_value(json!({
            "project_id": proj,
            "title": title.unwrap_or_default(),
            "content": content.unwrap_or_default(),
        }))
        .map_err(|e| e.to_string())?
    };
    world_wiki::logic::chapters::create_chapter_inner(&state.db, &proj, chap)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn assign_chapter(
    project: Option<String>,
    project_id: Option<String>,
    chapter_id: Option<String>,
    chapterId: Option<String>,
    volume_id: Option<String>,
    volumeId: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let proj = project.or(project_id).unwrap_or_default();
    let chap = chapter_id.or(chapterId).unwrap_or_default();
    let vol = volume_id.or(volumeId);
    let res = world_wiki::logic::volumes::assign_chapter_inner(&state.db, &proj, &chap, vol)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(res).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_volume(
    id: Option<String>,
    volume_id: Option<String>,
    title: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vol_id = id.or(volume_id).unwrap_or_default();
    world_wiki::logic::volumes::update_volume_inner(&state.db, &vol_id, &title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_chapter(
    chapter: Chapter,
    state: State<'_, AppState>,
) -> Result<Chapter, String> {
    world_wiki::logic::chapters::save_chapter_inner(&state.db, chapter)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chapter(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<Chapter>, String> {
    world_wiki::logic::chapters::get_chapter_inner(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_chapter(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    world_wiki::logic::chapters::delete_chapter_inner(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}
