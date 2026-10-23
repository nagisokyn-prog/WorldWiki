use tauri::State;
use worldwiki_domain::plot::PlotPromise;
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
            kind,
            title,
            note,
            status,
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
            } AS milestones
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
