use tauri::State;
use serde_json::Value;
use worldwiki_application::workflows::{EditManuscriptRequest, EditManuscriptResult};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn ai_query_world(
    state: State<'_, AppState>,
    project_id: String,
    query: String,
    scope: String,
    top_k: Option<usize>,
) -> Result<Vec<Value>, IpcError> {
    state
        .services
        .ai_tools
        .query_world(&project_id, &query, &scope, top_k.unwrap_or(8))
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_inspect_entity(
    state: State<'_, AppState>,
    entity_id: String,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .inspect_entity(&entity_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_manage_entity(
    state: State<'_, AppState>,
    action: String,
    payload: Value,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .manage_entity(&action, payload)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_read_manuscript(
    state: State<'_, AppState>,
    chapter_id: String,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .read_manuscript(&chapter_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_edit_manuscript(
    state: State<'_, AppState>,
    request: EditManuscriptRequest,
) -> Result<EditManuscriptResult, IpcError> {
    state
        .services
        .ai_tools
        .edit_manuscript(request)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_timeline_manager(
    state: State<'_, AppState>,
    action: String,
    payload: Value,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .timeline_manager(&action, payload)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_audit_consistency(
    state: State<'_, AppState>,
    target_type: String,
    target_id: String,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .audit_consistency(&target_type, &target_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn ai_delegate_task(
    state: State<'_, AppState>,
    task_id: String,
    prompt: String,
) -> Result<Value, IpcError> {
    state
        .services
        .ai_tools
        .delegate_task(&task_id, &prompt)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn reindex_project_lore(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<usize, String> {
    let db = &state.services.db;
    worldwiki_infrastructure::ai::reindex_project_lore_inner(db, &project_id).await
}

