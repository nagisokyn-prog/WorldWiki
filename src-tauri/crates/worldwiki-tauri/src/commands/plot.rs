use tauri::State;
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_application::plot::VolumeAuditReport;
use crate::error::IpcError;
use crate::bridge_command;
use crate::state::AppState;

#[tauri::command]
pub async fn get_plot_promises(
    project: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, IpcError> {
    let clean = project.trim_start_matches("projects:").to_string();
    let sql = "RETURN fn::list_plot_promises_by_project($p);";
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

bridge_command!(
    delete_plot_promise(id: String) -> Result<(), IpcError>
        => plot.delete_promise(&id)
);

bridge_command!(
    plant_plot_promise(promise: PlotPromise) -> Result<(), IpcError>
        => plot.plant_promise(&promise)
);

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
        .map_err(IpcError::from)?;

    if let Some(saved) = state
        .services
        .plot
        .promise_repo
        .get_by_id(&promise.id)
        .await
        .map_err(IpcError::from)?
    {
        Ok(saved)
    } else {
        Ok(promise)
    }
}

bridge_command!(
    complete_plan(plan_id: String) -> Result<(), IpcError>
        => plot.complete_todo(&plan_id)
);

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
        .map_err(|e| {
            eprintln!("[IPC ERROR][get_todos] owner_id={}: {}", owner_id, e);
            IpcError::from(e)
        })
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
        .map_err(|e| {
            eprintln!("[IPC ERROR][create_todo] owner_id={}, text={}: {}", owner_id, text, e);
            IpcError::from(e)
        })
}

#[tauri::command]
pub async fn update_todo(
    id: String,
    text: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .plot
        .update_todo(&id, &text)
        .await
        .map_err(|e| {
            eprintln!("[IPC ERROR][update_todo] id={}, text={}: {}", id, text, e);
            IpcError::from(e)
        })
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
        .map_err(|e| {
            eprintln!("[IPC ERROR][toggle_todo] id={}: {}", id, e);
            IpcError::from(e)
        })
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
        .map_err(|e| {
            eprintln!("[IPC ERROR][delete_todo] id={}: {}", id, e);
            IpcError::from(e)
        })
}

bridge_command!(
    audit_volume_consistency(volume_id: String) -> Result<VolumeAuditReport, IpcError>
        => plot.audit_volume(&volume_id)
);
