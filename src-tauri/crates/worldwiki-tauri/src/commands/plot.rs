use tauri::State;
use worldwiki_domain::plot::PlotPromise;
use worldwiki_application::plot::VolumeAuditReport;
use crate::error::IpcError;
use crate::state::AppState;

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
        .complete_plan(&plan_id)
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
