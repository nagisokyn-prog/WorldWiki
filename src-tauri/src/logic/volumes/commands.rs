//! IPC layer for module `volumes`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use tauri::{AppHandle, Emitter};

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
pub async fn assign_chapter(
    app: AppHandle,
    project: String,
    chapter_id: String,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<AutoExtendResult, String> {
    let res = assign_chapter_inner(&state.db, &project, &chapter_id, volume_id).await?;
    let _ = app.emit("ww:timeline-auto-extended", &res);
    Ok(res)
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

#[tauri::command]
pub async fn auto_extend_timeline(
    app: AppHandle,
    project: String,
    chapter_id: String,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<AutoExtendResult, String> {
    let updated_count =
        auto_extend_entities_inner(&state.db, &project, &chapter_id, volume_id.clone()).await?;
    let res = AutoExtendResult {
        chapter_id,
        volume_id,
        updated_count,
    };
    let _ = app.emit("ww:timeline-auto-extended", &res);
    Ok(res)
}

#[tauri::command]
pub async fn heal_deleted_chapter(
    app: AppHandle,
    project: String,
    deleted_chapter_id: String,
    fallback_point: Option<AutoExtendResult>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<u64, String> {
    let updated_count = heal_deleted_chapter_inner(
        &state.db,
        &project,
        &deleted_chapter_id,
        fallback_point.clone(),
    )
    .await?;
    if let Some(ref fb) = fallback_point {
        let _ = app.emit("ww:timeline-auto-extended", fb);
    }
    let _ = app.emit(
        "ww:timeline-healed",
        serde_json::json!({
            "deleted_chapter_id": deleted_chapter_id,
            "fallback_point": fallback_point,
            "updated_count": updated_count
        }),
    );
    Ok(updated_count)
}
