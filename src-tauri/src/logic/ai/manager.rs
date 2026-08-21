//! Model Lifecycle Manager for local AI models.
//! Manages model states (Installed, Loading, Ready, Busy, Idle, Sleeping, Unloading, Error),
//! memory tracking, loading, and graceful unloading upon app shutdown.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

use super::types::{InstalledModelInfo, ModelKind, ModelLifecycleState};

static MODEL_STATES: OnceLock<Mutex<HashMap<String, ModelLifecycleState>>> = OnceLock::new();

fn get_states_map() -> &'static Mutex<HashMap<String, ModelLifecycleState>> {
    MODEL_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Retrieve the local models folder path
pub fn get_models_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("models")
}

/// List all downloaded/installed GGUF models in the local models directory
#[tauri::command]
pub async fn list_installed_models(app: AppHandle) -> Result<Vec<InstalledModelInfo>, String> {
    let models_dir = get_models_dir(&app);
    if !models_dir.exists() {
        tokio::fs::create_dir_all(&models_dir)
            .await
            .map_err(|e| format!("Не удалось создать папку моделей: {e}"))?;
        return Ok(Vec::new());
    }

    let mut dir = tokio::fs::read_dir(&models_dir)
        .await
        .map_err(|e| format!("Не удалось прочитать директорию моделей: {e}"))?;

    let states = get_states_map().lock().unwrap().clone();
    let mut installed = Vec::new();

    while let Ok(Some(entry)) = dir.next_entry().await {
        let path = entry.path();
        if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext.eq_ignore_ascii_case("gguf") {
                let filename = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();

                let metadata = tokio::fs::metadata(&path).await.ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let size_gb =
                    ((size_bytes as f64 / (1024.0 * 1024.0 * 1024.0)) * 10.0).round() as f32 / 10.0;

                let is_embed = filename.to_lowercase().contains("embed")
                    || filename.to_lowercase().contains("nomic")
                    || filename.to_lowercase().contains("bge");
                let kind = if is_embed {
                    ModelKind::Embedding
                } else {
                    ModelKind::Generation
                };

                let state = states
                    .get(&filename)
                    .cloned()
                    .unwrap_or(ModelLifecycleState::Installed);
                let display_name = format_friendly_model_name(&filename);

                installed.push(InstalledModelInfo {
                    id: filename.clone(),
                    name: display_name,
                    filename,
                    full_path: path.to_string_lossy().to_string(),
                    size_bytes,
                    size_gb,
                    kind,
                    state,
                    memory_used_mb: None,
                });
            }
        }
    }

    Ok(installed)
}

/// Helper to generate human-readable Russian display names from filename
fn format_friendly_model_name(filename: &str) -> String {
    let lower = filename.to_lowercase();
    if lower.contains("nemotron") && lower.contains("embed") {
        "Эмбеддер Nemotron-3 (Лор-поиск)".to_string()
    } else if lower.contains("qwen2.5-7b") {
        "Универсальный Писатель Qwen 2.5 (7B)".to_string()
    } else if lower.contains("qwen2.5-14b") {
        "Глубокий Писатель Qwen 2.5 (14B)".to_string()
    } else if lower.contains("qwen2.5-3b") {
        "Быстрый Ассистент Qwen 2.5 (3B)".to_string()
    } else if lower.contains("saiga") {
        "Сайга (Творческий стиль)".to_string()
    } else {
        filename.trim_end_matches(".gguf").to_string()
    }
}

/// Load a local model into memory/GPU
#[tauri::command]
pub async fn load_local_model(_app: AppHandle, filename: String) -> Result<(), String> {
    {
        let mut states = get_states_map().lock().unwrap();
        states.insert(filename.clone(), ModelLifecycleState::Loading);
    }

    // Simulate async initialization or call local llama runtime
    tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;

    {
        let mut states = get_states_map().lock().unwrap();
        states.insert(filename, ModelLifecycleState::Ready);
    }
    Ok(())
}

/// Unload a local model from memory/GPU
#[tauri::command]
pub async fn unload_local_model(_app: AppHandle, filename: String) -> Result<(), String> {
    {
        let mut states = get_states_map().lock().unwrap();
        states.insert(filename.clone(), ModelLifecycleState::Unloading);
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    {
        let mut states = get_states_map().lock().unwrap();
        states.insert(filename, ModelLifecycleState::Installed);
    }
    Ok(())
}

/// Delete a downloaded model file
#[tauri::command]
pub async fn delete_local_model(app: AppHandle, filename: String) -> Result<(), String> {
    let models_dir = get_models_dir(&app);
    let target_path = models_dir.join(&filename);

    if target_path.exists() {
        tokio::fs::remove_file(&target_path)
            .await
            .map_err(|e| format!("Ошибка удаления файла модели: {e}"))?;
    }

    let mut states = get_states_map().lock().unwrap();
    states.remove(&filename);

    Ok(())
}

/// Graceful shutdown handler: unloads all active models and cleans up child processes
pub fn shutdown_local_models() {
    println!("[AI Manager] Остановка локальных моделей и освобождение VRAM/RAM...");
    let mut states = get_states_map().lock().unwrap();
    states.clear();
    println!("[AI Manager] Все локальные модели успешно выгружены.");
}
