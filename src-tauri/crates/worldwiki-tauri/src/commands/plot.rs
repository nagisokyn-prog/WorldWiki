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
        .map_err(IpcError::from_display)?;
    let items: Vec<serde_json::Value> = res.take(0).map_err(IpcError::from_display)?;
    Ok(items)
}

#[tauri::command]
pub async fn get_plot_promise(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<serde_json::Value>, IpcError> {
    let clean = id.trim_start_matches("plot_promises:").to_string();
    let sql = "RETURN fn::get_plot_promise($id);";
    let mut res = state
        .services
        .db
        .query(sql)
        .bind(("id", clean))
        .await
        .map_err(IpcError::from_display)?;
    let item: Option<serde_json::Value> = res.take(0).map_err(IpcError::from_display)?;
    Ok(item)
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
    _project: String,
    data: PlotPromise,
    state: State<'_, AppState>,
) -> Result<PlotPromise, IpcError> {
    let promise = data;
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

fn clamp_sort_order(sort_order: Option<i64>) -> i32 {
    match sort_order {
        Some(s) if s > (i32::MAX as i64) || s < (i32::MIN as i64) => (s % (i32::MAX as i64)) as i32,
        Some(s) => s as i32,
        None => 0,
    }
}

#[tauri::command]
pub async fn get_todos(
    owner_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Todo>, IpcError> {
    match state.services.plot.list_todos_by_owner(&owner_id).await {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!("[IPC ERROR][get_todos] owner_id={}: {}", owner_id, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn create_todo(
    owner_id: String,
    text: String,
    sort_order: Option<i64>,
    arc_id: Option<String>,
    depends_on: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, IpcError> {
    let order_i32 = clamp_sort_order(sort_order);

    match state
        .services
        .plot
        .create_todo_ext(&owner_id, &text, order_i32, arc_id, depends_on)
        .await
    {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!("[IPC ERROR][create_todo] owner_id={}, text={}: {}", owner_id, text, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn set_todo_status(
    id: String,
    status: String,
    state: State<'_, AppState>,
) -> Result<Todo, IpcError> {
    match state.services.plot.set_todo_status(&id, &status).await {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!("[IPC ERROR][set_todo_status] id={}, status={}: {}", id, status, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn set_todo_dependency(
    id: String,
    depends_on: Option<String>,
    state: State<'_, AppState>,
) -> Result<Todo, IpcError> {
    match state.services.plot.set_todo_dependency(&id, depends_on.clone()).await {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!("[IPC ERROR][set_todo_dependency] id={}, depends_on={:?}: {}", id, depends_on, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn auto_start_chapter(
    chapter_id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    match state.services.plot.auto_start_chapter(&chapter_id).await {
        Ok(()) => Ok(()),
        Err(e) => {
            eprintln!("[IPC ERROR][auto_start_chapter] chapter_id={}: {}", chapter_id, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn update_todo(
    id: String,
    text: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    match state.services.plot.update_todo(&id, &text).await {
        Ok(()) => Ok(()),
        Err(e) => {
            eprintln!("[IPC ERROR][update_todo] id={}, text={}: {}", id, text, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn toggle_todo(
    id: String,
    state: State<'_, AppState>,
) -> Result<Todo, IpcError> {
    match state.services.plot.toggle_todo(&id).await {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!("[IPC ERROR][toggle_todo] id={}: {}", id, e);
            Err(IpcError::from(e))
        }
    }
}

#[tauri::command]
pub async fn delete_todo(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    match state.services.plot.delete_todo(&id).await {
        Ok(()) => Ok(()),
        Err(e) => {
            eprintln!("[IPC ERROR][delete_todo] id={}: {}", id, e);
            Err(IpcError::from(e))
        }
    }
}

bridge_command!(
    audit_volume_consistency(volume_id: String) -> Result<VolumeAuditReport, IpcError>
        => plot.audit_volume(&volume_id)
);
