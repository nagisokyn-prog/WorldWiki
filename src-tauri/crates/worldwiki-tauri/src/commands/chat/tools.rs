use tauri::State;
use worldwiki_application::ApplicationError;
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn execute_ai_tool_direct(
    state: State<'_, AppState>,
    project: String,
    tool_name: String,
    tool_input: serde_json::Value,
) -> Result<serde_json::Value, IpcError> {
    let (res_str, is_err) = state
        .services
        .chat
        .execute_tool(&project, "", "", "direct", &tool_name, &tool_input)
        .await;

    if is_err {
        Err(ApplicationError::ExecutionFailed(res_str).into())
    } else {
        let val = serde_json::from_str::<serde_json::Value>(&res_str)
            .unwrap_or(serde_json::Value::String(res_str));
        Ok(val)
    }
}

#[tauri::command]
pub async fn ai_respond_tool_approval(
    state: State<'_, AppState>,
    call_id: String,
    approved: bool,
) -> Result<bool, IpcError> {
    Ok(state.services.chat.respond_tool_approval(&call_id, approved))
}
