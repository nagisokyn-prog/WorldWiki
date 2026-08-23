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

    #[cfg(feature = "ai-local")]
    let loaded_filename = {
        use crate::logic::ai::local_llm::get_loaded_model_slot;
        get_loaded_model_slot().lock().ok().and_then(|slot| {
            slot.as_ref().map(|s| s.model_path.clone())
        })
    };

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

                #[cfg(feature = "ai-local")]
                let state = if let Some(ref lfn) = loaded_filename {
                    if lfn == &filename {
                        ModelLifecycleState::Ready
                    } else {
                        states.get(&filename).cloned().unwrap_or(ModelLifecycleState::Installed)
                    }
                } else {
                    states.get(&filename).cloned().unwrap_or(ModelLifecycleState::Installed)
                };

                #[cfg(not(feature = "ai-local"))]
                let state = states.get(&filename).cloned().unwrap_or(ModelLifecycleState::Installed);

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

pub fn set_model_lifecycle_state(filename: &str, state: ModelLifecycleState) {
    let mut states = get_states_map().lock().unwrap();
    states.insert(filename.to_string(), state);
}

/// Load a local model into memory/GPU
#[tauri::command]
pub async fn load_local_model(_app: AppHandle, filename: String) -> Result<(), String> {
    set_model_lifecycle_state(&filename, ModelLifecycleState::Loading);

    #[cfg(feature = "ai-local")]
    {
        use crate::logic::ai::local_llm::{get_loaded_embed_slot, get_loaded_model_slot, resolve_model_path, LoadedModelSlot, LocalLlm, ModelParams};
        let resolved = resolve_model_path(&filename);
        if !resolved.exists() {
            set_model_lifecycle_state(&filename, ModelLifecycleState::Error);
            return Err(format!("Файл модели не найден: {filename}"));
        }

        let is_embed = filename.to_lowercase().contains("embed")
            || filename.to_lowercase().contains("nomic")
            || filename.to_lowercase().contains("bge");

        let path_str = resolved.to_string_lossy().to_string();
        let load_res = tauri::async_runtime::spawn_blocking(move || {
            let params = ModelParams {
                n_gpu_layers: -1,
                ..Default::default()
            };
            if is_embed {
                LocalLlm::load_embedding_model(&path_str, params)
            } else {
                LocalLlm::load_model(&path_str, params)
            }
        }).await.map_err(|e| e.to_string())?;

        match load_res {
            Ok(llm) => {
                if is_embed {
                    let mut slot = get_loaded_embed_slot().lock().unwrap();
                    *slot = Some(LoadedModelSlot {
                        model_path: filename.clone(),
                        llm,
                    });
                } else {
                    let mut slot = get_loaded_model_slot().lock().unwrap();
                    *slot = Some(LoadedModelSlot {
                        model_path: filename.clone(),
                        llm,
                    });
                }
                set_model_lifecycle_state(&filename, ModelLifecycleState::Ready);
                println!("[AI Manager] Модель {filename} успешно загружена в память GPU.");
                Ok(())
            }
            Err(e) => {
                set_model_lifecycle_state(&filename, ModelLifecycleState::Error);
                Err(format!("Ошибка загрузки модели: {e}"))
            }
        }
    }

    #[cfg(not(feature = "ai-local"))]
    {
        set_model_lifecycle_state(&filename, ModelLifecycleState::Error);
        Err("Локальный инференс отключен (нет feature ai-local)".to_string())
    }
}

/// Unload a local model from memory/GPU
#[tauri::command]
pub async fn unload_local_model(_app: AppHandle, filename: String) -> Result<(), String> {
    set_model_lifecycle_state(&filename, ModelLifecycleState::Unloading);

    #[cfg(feature = "ai-local")]
    {
        use crate::logic::ai::local_llm::{get_loaded_embed_slot, get_loaded_model_slot};
        if filename.to_lowercase().contains("embed") || filename.to_lowercase().contains("nomic") {
            let mut slot = get_loaded_embed_slot().lock().unwrap();
            *slot = None;
        } else {
            let mut slot = get_loaded_model_slot().lock().unwrap();
            *slot = None;
        }
        println!("[AI Manager] Модель {filename} выгружена из GPU.");
    }

    set_model_lifecycle_state(&filename, ModelLifecycleState::Installed);
    Ok(())
}

/// Delete a downloaded model file
#[tauri::command]
pub async fn delete_local_model(app: AppHandle, filename: String) -> Result<(), String> {
    #[cfg(feature = "ai-local")]
    {
        use crate::logic::ai::local_llm::{get_loaded_embed_slot, get_loaded_model_slot};
        if let Ok(mut slot) = get_loaded_model_slot().lock() {
            if let Some(ref loaded) = *slot {
                if loaded.model_path == filename {
                    *slot = None;
                }
            }
        }
        if let Ok(mut slot) = get_loaded_embed_slot().lock() {
            if let Some(ref loaded) = *slot {
                if loaded.model_path == filename {
                    *slot = None;
                }
            }
        }
    }

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
    #[cfg(feature = "ai-local")]
    {
        use crate::logic::ai::local_llm::{get_loaded_embed_slot, get_loaded_model_slot};
        if let Ok(mut slot) = get_loaded_model_slot().lock() {
            *slot = None;
        }
        if let Ok(mut slot) = get_loaded_embed_slot().lock() {
            *slot = None;
        }
    }
    let mut states = get_states_map().lock().unwrap();
    states.clear();
    println!("[AI Manager] Все локальные модели успешно выгружены.");
}
