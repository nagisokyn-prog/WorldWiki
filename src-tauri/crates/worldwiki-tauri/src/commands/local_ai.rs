use tauri::State;
use worldwiki_domain::ai::{
    HardwareInfo, MemoryEstimation, RecommendedModelCard, InstalledModelInfo, ToolPermissionConfig,
};
use crate::error::IpcError;
use crate::bridge_command;
use crate::state::AppState;

#[tauri::command]
pub fn get_hardware_info(state: State<'_, AppState>) -> HardwareInfo {
    state.services.local_ai.get_hardware_info()
}

#[tauri::command]
pub fn calculate_quantization_estimates(
    state: State<'_, AppState>,
    params_billions: f32,
    context_tokens: Option<usize>,
) -> Vec<MemoryEstimation> {
    state
        .services
        .local_ai
        .calculate_quantization_estimates(params_billions, context_tokens)
}

#[tauri::command]
pub fn get_recommended_local_models(state: State<'_, AppState>) -> Vec<RecommendedModelCard> {
    state.services.local_ai.get_recommended_local_models()
}

bridge_command!(
    sync list_installed_models() -> Result<Vec<InstalledModelInfo>, IpcError>
        => local_ai.list_installed_models()
);

bridge_command!(
    sync load_local_model(filename: String) -> Result<String, IpcError>
        => local_ai.load_local_model(&filename)
);

bridge_command!(
    sync unload_local_model(filename: String) -> Result<String, IpcError>
        => local_ai.unload_local_model(&filename)
);

bridge_command!(
    sync unload_all_local_models() -> Result<String, IpcError>
        => local_ai.unload_all_local_models()
);

bridge_command!(
    sync delete_local_model(filename: String) -> Result<String, IpcError>
        => local_ai.delete_local_model(&filename)
);

#[tauri::command]
pub fn get_tool_permissions_catalog(state: State<'_, AppState>) -> Vec<ToolPermissionConfig> {
    state.services.local_ai.get_tool_permissions_catalog()
}

bridge_command!(
    sync save_tool_permission(
        tool_id: String,
        level: String,
    ) -> Result<(), IpcError>
        => local_ai.save_tool_permission(&tool_id, &level)
);

bridge_command!(
    sync save_all_tool_permissions(permissions: std::collections::HashMap<String, String>) -> Result<(), IpcError>
        => local_ai.save_all_tool_permissions(&permissions)
);

#[tauri::command]
pub async fn get_ai_completion(
    _state: State<'_, AppState>,
    _text_before: String,
    _project_id: Option<String>,
) -> Result<String, IpcError> {
    // Inline GhostText completion endpoint
    Ok("".to_string())
}


#[tauri::command]
pub async fn fetch_hf_models(
    query: Option<String>,
    token: Option<String>,
) -> Result<Vec<worldwiki_domain::ai::types::HfModelCard>, IpcError> {
    #[cfg(feature = "ai")]
    {
        worldwiki_ai::fetch_hf_models_inner(query.as_deref(), token.as_deref(), None)
            .await
            .map_err(IpcError::from)
    }
    #[cfg(not(feature = "ai"))]
    {
        let _ = (query, token);
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn download_hf_model(
    app: tauri::AppHandle,
    repo_id: String,
    filename: String,
    token: Option<String>,
) -> Result<String, IpcError> {
    use tauri::{Emitter, Manager};
    use tokio::io::AsyncWriteExt;
    use std::path::PathBuf;

    let models_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("models");

    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Не удалось создать директорию моделей: {e}"))?;

    let dest_path = models_dir.join(&filename);
    let download_url = format!("https://huggingface.co/{repo_id}/resolve/main/{filename}");

    let client = reqwest::Client::new();
    let mut req = client
        .get(&download_url)
        .header("User-Agent", "WorldWiki/1.0");

    if let Some(tok) = token {
        let t = tok.trim();
        if !t.is_empty() {
            req = req.header("Authorization", format!("Bearer {t}"));
        }
    }

    let mut resp = req
        .send()
        .await
        .map_err(|e| format!("Ошибка запроса на скачивание: {e}"))?;

    if resp.status().as_u16() == 401 {
        return Err(IpcError::from("Ошибка 401 (Нет доступа): Модель требует авторизации через HF Token или файл не найден в репозитории."));
    } else if resp.status().as_u16() == 404 {
        return Err(IpcError::from("Ошибка 404: Файл модели не найден на сервере Hugging Face."));
    } else if !resp.status().is_success() {
        return Err(IpcError::from(format!(
            "Загрузка завершилась со статусом: {}",
            resp.status()
        )));
    }

    #[derive(Clone, serde::Serialize)]
    struct BorrowedProgressEvent<'a> {
        repo_id: &'a str,
        filename: &'a str,
        downloaded_bytes: u64,
        total_bytes: u64,
        percent: f32,
        is_done: bool,
        error: Option<&'a str>,
    }

    let total_bytes = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create target file: {e}"))?;

    let mut downloaded_bytes = 0u64;
    let mut last_emitted_percent = 0.0f32;
    let mut last_emit_time = std::time::Instant::now();

    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        let err_msg = format!("Chunk stream error: {e}");
        let _ = app.emit(
            "model_download_progress",
            BorrowedProgressEvent {
                repo_id: &repo_id,
                filename: &filename,
                downloaded_bytes,
                total_bytes,
                percent: 0.0,
                is_done: false,
                error: Some(&err_msg),
            },
        );
        err_msg
    })? {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("File write error: {e}"))?;

        downloaded_bytes += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            (downloaded_bytes as f64 / total_bytes as f64 * 100.0) as f32
        } else {
            0.0
        };

        if percent - last_emitted_percent >= 0.2 || last_emit_time.elapsed().as_millis() >= 200 {
            last_emitted_percent = percent;
            last_emit_time = std::time::Instant::now();

            let _ = app.emit(
                "model_download_progress",
                BorrowedProgressEvent {
                    repo_id: &repo_id,
                    filename: &filename,
                    downloaded_bytes,
                    total_bytes,
                    percent,
                    is_done: false,
                    error: None,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {e}"))?;

    let _ = app.emit(
        "model_download_progress",
        BorrowedProgressEvent {
            repo_id: &repo_id,
            filename: &filename,
            downloaded_bytes,
            total_bytes,
            percent: 100.0,
            is_done: true,
            error: None,
        },
    );

    Ok(dest_path.to_string_lossy().to_string())
}

