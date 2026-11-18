use tauri::{AppHandle, Emitter, State};
use worldwiki_infrastructure::surrealdb::repos::volume_ops_repo::{self, AutoExtendResult};

use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, IpcError> {
    volume_ops_repo::get_chapter_hierarchy(&state.services.db, &project)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn create_volume(
    project: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, IpcError> {
    volume_ops_repo::create_volume(&state.services.db, &project, &title)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn update_volume(
    _project: String,
    id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    volume_ops_repo::update_volume(&state.services.db, &id, &title)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn reorder_node(
    project: String,
    node_type: String,
    id: String,
    sort_order: i64,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    volume_ops_repo::reorder_node(&state.services.db, &project, &node_type, &id, sort_order)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn assign_chapter(
    app: AppHandle,
    project: String,
    chapter_id: String,
    volume_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<AutoExtendResult, IpcError> {
    let res =
        volume_ops_repo::assign_chapter(&state.services.db, &project, &chapter_id, volume_id)
            .await
            .map_err(IpcError::from)?;
    if let Err(e) = app.emit("ww:timeline-auto-extended", &res) {
        eprintln!(
            "[VOLUMES IPC ERROR] Failed to emit 'ww:timeline-auto-extended': {e:?}, payload: {res:?}"
        );
    }
    Ok(res)
}

#[tauri::command]
pub async fn auto_extend_timeline(
    app: AppHandle,
    project: String,
    chapter_id: String,
    volume_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<AutoExtendResult, IpcError> {
    let updated_count = volume_ops_repo::auto_extend_entities(
        &state.services.db,
        &project,
        &chapter_id,
        volume_id.clone(),
    )
    .await
    .map_err(IpcError::from)?;
    let res = AutoExtendResult {
        chapter_id,
        volume_id,
        updated_count,
    };
    if let Err(e) = app.emit("ww:timeline-auto-extended", &res) {
        eprintln!(
            "[VOLUMES IPC ERROR] Failed to emit 'ww:timeline-auto-extended': {e:?}, payload: {res:?}"
        );
    }
    Ok(res)
}

#[tauri::command]
pub async fn heal_deleted_chapter(
    app: AppHandle,
    project: String,
    deleted_chapter_id: String,
    fallback_point: Option<AutoExtendResult>,
    state: State<'_, AppState>,
) -> Result<u64, IpcError> {
    let updated_count = volume_ops_repo::heal_deleted_chapter(
        &state.services.db,
        &project,
        &deleted_chapter_id,
        fallback_point.clone(),
    )
    .await
    .map_err(IpcError::from)?;
    if let Some(ref fb) = fallback_point
        && let Err(e) = app.emit("ww:timeline-auto-extended", fb)
    {
        eprintln!(
            "[VOLUMES IPC ERROR] Failed to emit 'ww:timeline-auto-extended': {e:?}, payload: {fb:?}"
        );
    }
    if let Err(e) = app.emit(
        "ww:timeline-healed",
        serde_json::json!({
            "deleted_chapter_id": deleted_chapter_id,
            "fallback_point": fallback_point,
            "updated_count": updated_count
        }),
    ) {
        eprintln!("[VOLUMES IPC ERROR] Failed to emit 'ww:timeline-healed': {e:?}");
    }
    Ok(updated_count)
}
