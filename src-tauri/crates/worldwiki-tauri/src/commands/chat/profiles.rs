use tauri::State;
use worldwiki_domain::ai::{AiModelInfo, AiProfile};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn fetch_ai_models(
    state: State<'_, AppState>,
    provider: String,
    api_key: Option<String>,
) -> Result<Vec<AiModelInfo>, IpcError> {
    state
        .services
        .chat
        .fetch_models(&provider, api_key.as_deref())
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_aiprofiles(
    state: State<'_, AppState>,
    project: String,
) -> Result<Vec<AiProfile>, IpcError> {
    state
        .services
        .chat
        .get_profiles(&project)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_aiprofile(
    state: State<'_, AppState>,
    data: AiProfile,
) -> Result<AiProfile, IpcError> {
    state
        .services
        .chat
        .save_profile(&data)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_aiprofile(
    state: State<'_, AppState>,
    _project: String,
    id: String,
) -> Result<(), IpcError> {
    state
        .services
        .chat
        .delete_profile(&id)
        .await
        .map_err(IpcError::from)
}
