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
    list_installed_models_inner(&models_dir).await
}

/// Тестируемое ядро сканирования папки моделей (без `AppHandle`).
pub async fn list_installed_models_inner(
    models_dir: &std::path::Path,
) -> Result<Vec<InstalledModelInfo>, String> {
    if !models_dir.exists() {
        tokio::fs::create_dir_all(models_dir)
            .await
            .map_err(|e| format!("Не удалось создать папку моделей: {e}"))?;
        return Ok(Vec::new());
    }

    let mut dir = tokio::fs::read_dir(models_dir)
        .await
        .map_err(|e| format!("Не удалось прочитать директорию моделей: {e}"))?;

    let states = get_states_map().lock().unwrap().clone();
    let mut installed = Vec::new();

    #[cfg(feature = "ai-local")]
    let (loaded_gen_fn, loaded_emb_fn) = {
        use crate::logic::ai::local_llm::{get_loaded_embed_slot, get_loaded_model_slot};
        let gen_fn = get_loaded_model_slot()
            .try_lock()
            .ok()
            .and_then(|slot| slot.as_ref().map(|s| s.model_path.clone()));
        let emb_fn = get_loaded_embed_slot()
            .try_lock()
            .ok()
            .and_then(|slot| slot.as_ref().map(|s| s.model_path.clone()));
        (gen_fn, emb_fn)
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
                let state = if is_embed {
                    if let Some(ref efn) = loaded_emb_fn {
                        if efn == &filename || efn.ends_with(&filename) {
                            ModelLifecycleState::Ready
                        } else {
                            states
                                .get(&filename)
                                .cloned()
                                .unwrap_or(ModelLifecycleState::Installed)
                        }
                    } else {
                        states
                            .get(&filename)
                            .cloned()
                            .unwrap_or(ModelLifecycleState::Installed)
                    }
                } else {
                    if let Some(ref gfn) = loaded_gen_fn {
                        if gfn == &filename || gfn.ends_with(&filename) {
                            ModelLifecycleState::Ready
                        } else {
                            states
                                .get(&filename)
                                .cloned()
                                .unwrap_or(ModelLifecycleState::Installed)
                        }
                    } else {
                        states
                            .get(&filename)
                            .cloned()
                            .unwrap_or(ModelLifecycleState::Installed)
                    }
                };

                #[cfg(not(feature = "ai-local"))]
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
        use crate::logic::ai::local_llm::{
            get_loaded_embed_slot, get_loaded_model_slot, resolve_model_path, LoadedModelSlot,
            LocalLlm, ModelParams,
        };
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
        })
        .await
        .map_err(|e| e.to_string())?;

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
        use crate::logic::ai::local_llm::{
            get_loaded_embed_slot, get_loaded_model_slot, trigger_cancel_local_gen,
        };
        trigger_cancel_local_gen();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

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
        use crate::logic::ai::local_llm::{
            get_loaded_embed_slot, get_loaded_model_slot, trigger_cancel_local_gen,
        };
        trigger_cancel_local_gen();
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

/// Emergency unload of ALL local models from GPU and RAM
#[tauri::command]
pub async fn unload_all_local_models(_app: AppHandle) -> Result<(), String> {
    #[cfg(feature = "ai-local")]
    {
        use crate::logic::ai::local_llm::{
            get_loaded_embed_slot, get_loaded_model_slot, trigger_cancel_local_gen,
        };
        trigger_cancel_local_gen();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        if let Ok(mut slot) = get_loaded_model_slot().lock() {
            *slot = None;
        }
        if let Ok(mut slot) = get_loaded_embed_slot().lock() {
            *slot = None;
        }
    }
    let mut states = get_states_map().lock().unwrap();
    states.clear();
    println!("[AI Manager] Все локальные модели экстренно выгружены из GPU!");
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logic::ai::types::ModelLifecycleState;

    // ---------- format_friendly_model_name ----------

    #[test]
    fn friendly_names_known_families() {
        assert_eq!(
            format_friendly_model_name("Nemotron-3-embed-1b.Q4_K_M.gguf"),
            "Эмбеддер Nemotron-3 (Лор-поиск)"
        );
        assert_eq!(
            format_friendly_model_name("Qwen2.5-7B-Instruct-Q4_K_M.gguf").to_lowercase(),
            "универсальный писатель qwen 2.5 (7b)".to_lowercase()
        );
        assert_eq!(
            format_friendly_model_name("Qwen2.5-14B-Instruct-Q8_0.gguf").to_lowercase(),
            "глубокий писатель qwen 2.5 (14b)".to_lowercase()
        );
        assert_eq!(
            format_friendly_model_name("Qwen2.5-3B-Instruct.gguf").to_lowercase(),
            "быстрый ассистент qwen 2.5 (3b)".to_lowercase()
        );
        assert_eq!(
            format_friendly_model_name("saiga-qwen-v2.gguf").to_lowercase(),
            "сайга (творческий стиль)".to_lowercase()
        );
    }

    #[test]
    fn unknown_model_keeps_filename_without_gguf_ext() {
        assert_eq!(
            format_friendly_model_name("Mistral-7B-Q5.gguf"),
            "Mistral-7B-Q5"
        );
        assert_eq!(format_friendly_model_name("plain"), "plain");
    }

    #[test]
    fn embed_marker_takes_priority_over_family() {
        // nemotron+embed проверяется первой веткой
        assert!(format_friendly_model_name("nemotron.embed.gguf").contains("Эмбеддер"));
    }

    // ---------- set_model_lifecycle_state ----------

    #[test]
    fn lifecycle_state_set_and_overwritten() {
        let name = "test-model-lifecycle.gguf";

        set_model_lifecycle_state(name, ModelLifecycleState::Loading);
        {
            let states = get_states_map().lock().unwrap();
            assert!(matches!(
                states.get(name),
                Some(ModelLifecycleState::Loading)
            ));
        }

        // Переход loading → ready
        set_model_lifecycle_state(name, ModelLifecycleState::Ready);
        {
            let states = get_states_map().lock().unwrap();
            assert!(matches!(states.get(name), Some(ModelLifecycleState::Ready)));
        }

        // Переход ready → unloading → installed
        set_model_lifecycle_state(name, ModelLifecycleState::Unloading);
        set_model_lifecycle_state(name, ModelLifecycleState::Installed);
        {
            let states = get_states_map().lock().unwrap();
            assert!(matches!(
                states.get(name),
                Some(ModelLifecycleState::Installed)
            ));
        }

        // Убираем за собой, чтобы не влиять на другие тесты
        get_states_map().lock().unwrap().remove(name);
    }

    // ---------- list_installed_models_inner (dir-scan) ----------

    async fn make_models_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("wwiki_mgr_test_{}_{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        tokio::fs::create_dir_all(&dir).await.unwrap();
        dir
    }

    #[tokio::test]
    async fn missing_dir_is_created_and_empty() {
        let dir = std::env::temp_dir().join(format!("wwiki_mgr_missing_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        let models = list_installed_models_inner(&dir).await.expect("Ok");
        assert!(models.is_empty(), "новая папка → пустой список");
        assert!(dir.exists(), "папка создана на месте");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn scan_lists_only_gguf_with_kind_and_size() {
        let dir = make_models_dir("scan").await;
        // generation-модель
        std::fs::write(dir.join("Qwen2.5-7B-Instruct-Q4_K_M.gguf"), vec![0u8; 2048]).unwrap();
        // embedding-модель (по маркеру nomic)
        std::fs::write(dir.join("nomic-embed-text.gguf"), vec![0u8; 1024]).unwrap();
        // не-gguf игнорируется
        std::fs::write(dir.join("notes.txt"), b"hi").unwrap();

        let models = list_installed_models_inner(&dir).await.expect("Ok");
        assert_eq!(models.len(), 2, "только .gguf: {models:?}");

        let qwen = models.iter().find(|m| m.filename.contains("Qwen")).unwrap();
        assert_eq!(qwen.kind, ModelKind::Generation);
        assert_eq!(qwen.size_bytes, 2048);
        assert_eq!(
            qwen.state,
            ModelLifecycleState::Installed,
            "без слотов — Installed"
        );
        assert!(!qwen.name.is_empty(), "friendly name сгенерирован");

        let emb = models
            .iter()
            .find(|m| m.filename.contains("nomic"))
            .unwrap();
        assert_eq!(emb.kind, ModelKind::Embedding, "маркер nomic → Embedding");

        // size_gb: 2048 байт ≈ 0.0 GB
        assert_eq!(qwen.size_gb, 0.0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn embed_markers_bge_and_embed_word() {
        let dir = make_models_dir("markers").await;
        std::fs::write(dir.join("bge-m3-Q8_0.gguf"), vec![0u8; 8]).unwrap();
        std::fs::write(dir.join("my-Embed-model.gguf"), vec![0u8; 8]).unwrap();

        let models = list_installed_models_inner(&dir).await.unwrap();
        assert_eq!(models.len(), 2);
        assert!(
            models.iter().all(|m| m.kind == ModelKind::Embedding),
            "оба маркера (bge, Embed) дают Embedding: {models:?}"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn subdirectories_are_skipped() {
        let dir = make_models_dir("subdirs").await;
        std::fs::create_dir_all(dir.join("nested")).unwrap();
        std::fs::write(dir.join("nested").join("inner.gguf"), b"x").unwrap();
        std::fs::write(dir.join("top.gguf"), b"x").unwrap();

        let models = list_installed_models_inner(&dir).await.unwrap();
        assert_eq!(models.len(), 1, "поддиректории не сканируются");
        assert_eq!(models[0].filename, "top.gguf");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
