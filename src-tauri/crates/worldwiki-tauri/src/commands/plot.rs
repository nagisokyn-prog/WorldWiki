use tauri::State;
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_application::plot::VolumeAuditReport;
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_plot_promises(
    project: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, IpcError> {
    let clean = project.trim_start_matches("projects:").to_string();
    let sql = r#"
        SELECT 
            id,
            project_id,
            chapter_id,
            paragraph_index,
            block_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
            created_at,
            updated_at,
            ->promise_milestones.{
                milestone_id: id,
                stage: stage,
                quote: quote,
                note: note,
                block_id: out.id,
                chapter_id: out.chapter_id,
                order_index: out.order_index
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: out.id,
                arc_phase: phase
            } AS arcs
        FROM plot_promises 
        WHERE project_id = fn::normalize_project_id($p);
    "#;
    let mut res = state
        .services
        .db
        .query(sql)
        .bind(("p", clean))
        .await
        .map_err(|e| IpcError::from(e.to_string()))?;
    let items: Vec<serde_json::Value> = res.take(0).map_err(|e| IpcError::from(e.to_string()))?;
    Ok(items)
}

#[tauri::command]
pub async fn delete_plot_promise(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .plot
        .delete_promise(&id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn plant_plot_promise(
    state: State<'_, AppState>,
    promise: PlotPromise,
) -> Result<(), IpcError> {
    state
        .services
        .plot
        .plant_promise(&promise)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_plot_promise(
    project: String,
    data: PlotPromise,
    state: State<'_, AppState>,
) -> Result<PlotPromise, IpcError> {
    let mut promise = data;
    // Normalize project_id to ensure it satisfies SurrealDB SCHEMAFULL requirement (record<projects>)
    let project_normalized = if project.starts_with("projects:") {
        project
    } else {
        format!("projects:{}", project)
    };
    promise.project_id = project_normalized;
    state
        .services
        .plot
        .save_promise(&promise)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn complete_plan(
    state: State<'_, AppState>,
    plan_id: String,
) -> Result<(), IpcError> {
    state
        .services
        .plot
        .complete_todo(&plan_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_todos(
    owner_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Todo>, IpcError> {
    state
        .services
        .plot
        .list_todos_by_owner(&owner_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn create_todo(
    owner_id: String,
    text: String,
    sort_order: Option<i32>,
    state: State<'_, AppState>,
) -> Result<String, IpcError> {
    state
        .services
        .plot
        .create_todo(&owner_id, &text, sort_order.unwrap_or(0))
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn toggle_todo(
    id: String,
    state: State<'_, AppState>,
) -> Result<Todo, IpcError> {
    state
        .services
        .plot
        .toggle_todo(&id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_todo(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .plot
        .delete_todo(&id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn audit_volume_consistency(
    state: State<'_, AppState>,
    volume_id: String,
) -> Result<VolumeAuditReport, IpcError> {
    state
        .services
        .plot
        .audit_volume(&volume_id)
        .await
        .map_err(IpcError::from)
}
