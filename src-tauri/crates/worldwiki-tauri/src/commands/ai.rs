use tauri::State;
use serde_json::Value;
use worldwiki_application::workflows::{EditManuscriptRequest, EditManuscriptResult};
use crate::error::IpcError;
use crate::bridge_command;
use crate::state::AppState;

bridge_command!(
    ai_query_world(
        project_id: String,
        query: String,
        scope: String,
        top_k: Option<usize>,
    ) -> Result<Vec<Value>, IpcError>
        => ai_tools.query_world(&project_id, &query, &scope, top_k.unwrap_or(8))
);

#[tauri::command]
pub async fn ai_inspect_entity(
    state: State<'_, AppState>,
    project_id: Option<String>,
    entity_id: String,
) -> Result<Value, IpcError> {
    let proj = project_id.unwrap_or_default();
    state
        .services
        .ai_tools
        .inspect_entity(&proj, &entity_id)
        .await
        .map_err(IpcError::from)
}

bridge_command!(
    ai_manage_entity(
        action: String,
        payload: Value,
    ) -> Result<Value, IpcError>
        => ai_tools.manage_entity(&action, payload)
);

#[tauri::command]
pub async fn ai_read_manuscript(
    state: State<'_, AppState>,
    project_id: Option<String>,
    chapter_id: String,
) -> Result<Value, IpcError> {
    let proj = project_id.unwrap_or_default();
    state
        .services
        .ai_tools
        .read_manuscript(&proj, &chapter_id)
        .await
        .map_err(IpcError::from)
}

bridge_command!(
    ai_edit_manuscript(request: EditManuscriptRequest) -> Result<EditManuscriptResult, IpcError>
        => ai_tools.edit_manuscript(request)
);

bridge_command!(
    ai_chronology(
        action: String,
        payload: Value,
    ) -> Result<Value, IpcError>
        => ai_tools.chronology(&action, payload)
);

bridge_command!(
    ai_timeline_manager(
        action: String,
        payload: Value,
    ) -> Result<Value, IpcError>
        => ai_tools.timeline_manager(&action, payload)
);

bridge_command!(
    ai_audit_consistency(
        target_type: String,
        target_id: String,
    ) -> Result<Value, IpcError>
        => ai_tools.audit_consistency(&target_type, &target_id)
);

bridge_command!(
    ai_delegate_task(
        task_id: String,
        prompt: String,
    ) -> Result<Value, IpcError>
        => ai_tools.delegate_task(&task_id, &prompt)
);

#[tauri::command]
pub async fn reindex_project_lore(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<usize, IpcError> {
    #[cfg(feature = "ai")]
    {
        let db = &state.services.db;
        worldwiki_ai::reindex_project_lore_inner(db, &project_id)
            .await
            .map_err(IpcError::from)
    }
    #[cfg(not(feature = "ai"))]
    {
        let _ = (state, project_id);
        Err(IpcError::from("AI feature is disabled in this build"))
    }
}

