use serde_json::Value;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

// ─── DataDirProvider: инъекция пути к data/ для тестов ────────────────────────

/// Трейт для получения каталога данных. Позволяет подменять в тестах.
pub trait DataDirProvider: std::fmt::Debug + Send + Sync {
    fn get_data_dir(&self) -> PathBuf;
}

/// Дефолтный провайдер: ищет `target/.../data` (dev) или `cwd/data` (prod).
#[derive(Debug)]
struct DefaultDataDirProvider;

impl DataDirProvider for DefaultDataDirProvider {
    fn get_data_dir(&self) -> PathBuf {
        if let Ok(exe) = env::current_exe() {
            // Dev: target/debug/app.exe -> target/debug -> target -> tauri_shell
            if let Some(debug_dir) = exe.parent() {
                if let Some(target_dir) = debug_dir.parent() {
                    if target_dir.ends_with("target") {
                        if let Some(root) = target_dir.parent() {
                            return root.join("data");
                        }
                    }
                }
            }
        }
        // Prod or fallback
        env::current_dir().unwrap_or_default().join("data")
    }
}

/// Глобальный провайдер (по умолчанию — DefaultDataDirProvider).
/// В тестах можно заменить через `set_data_dir_provider()`.
static DATA_DIR_PROVIDER: RwLock<Option<Box<dyn DataDirProvider>>> = RwLock::new(None);

/// Установить кастомный провайдер (для тестов).
#[allow(dead_code)]
pub fn set_data_dir_provider(provider: Box<dyn DataDirProvider>) {
    if let Ok(mut lock) = DATA_DIR_PROVIDER.write() {
        *lock = Some(provider);
    }
}

/// Сбросить провайдер к дефолтному (для изоляции тестов).
#[allow(dead_code)]
pub fn clear_data_dir_provider() {
    if let Ok(mut lock) = DATA_DIR_PROVIDER.write() {
        *lock = None;
    }
}

/// Получить каталог данных через активный провайдер.
fn get_data_dir() -> PathBuf {
    if let Ok(lock) = DATA_DIR_PROVIDER.read() {
        if let Some(ref provider) = *lock {
            return provider.get_data_dir();
        }
    }
    DefaultDataDirProvider.get_data_dir()
}

/// Upload a photo/image bytes → saves to `data/user_images/` with a timestamp prefix.
/// Returns the absolute path of the saved file.
#[tauri::command]
pub async fn upload_photo(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path).ok();
    let new_name = format!(
        "{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        filename
    );
    path.push(new_name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Copy a background file from absolute path -> saves to `data/user_images/`
/// Returns the absolute path of the copied file.
#[tauri::command]
pub async fn copy_background_file(source_path: String) -> Result<String, String> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path).ok();

    let source = std::path::Path::new(&source_path);
    let filename = source.file_name().unwrap_or_default().to_string_lossy();

    let new_name = format!(
        "{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        filename
    );
    path.push(new_name);
    fs::copy(&source_path, &path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Read a local file and return its bytes (used to serve local images to the webview).
#[tauri::command]
pub async fn get_local_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

// ─── Performance ──────────────────────────────────────────────────────────────

use crate::logic::performance::PerformanceInfo;

#[tauri::command]
pub fn run_performance_benchmark() -> PerformanceInfo {
    crate::logic::performance::run_benchmark()
}

#[tauri::command]
pub fn get_performance_styles(level: String) -> String {
    let perf = match level.as_str() {
        "low" => crate::logic::performance::PerformanceLevel::Low,
        "medium" => crate::logic::performance::PerformanceLevel::Medium,
        _ => crate::logic::performance::PerformanceLevel::High,
    };
    crate::logic::performance::get_performance_css(&perf)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/// Persist app settings JSON to `data/settings.json`.
#[tauri::command]
pub async fn save_settings(settings: Value) -> Result<(), String> {
    let path = get_data_dir().join("settings.json");
    fs::create_dir_all(path.parent().unwrap()).ok();
    fs::write(&path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Load app settings JSON from `data/settings.json`. Returns `null` if not found.
#[tauri::command]
pub async fn load_settings() -> Result<Value, String> {
    let path = get_data_dir().join("settings.json");
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(serde_json::from_str(&content).unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

// ─── Window ───────────────────────────────────────────────────────────────────

/// Toggle fullscreen mode for the current Tauri window.
#[tauri::command]
pub async fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Themes ───────────────────────────────────────────────────────────────────

/// List all custom themes stored as `data/settings-<name>.json`
/// (excludes built-in "light" and "dark").
#[tauri::command]
pub async fn get_custom_themes() -> Result<Vec<String>, String> {
    let path = get_data_dir();
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut themes = Vec::new();
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // Булт-ин темы: settings-light.json, settings-dark.json
                    if name.starts_with("settings-")
                        && name.ends_with(".json")
                        && !name.starts_with("settings-theme-")
                    {
                        let theme = name
                            .trim_start_matches("settings-")
                            .trim_end_matches(".json")
                            .to_string();
                        // Пропускаем settings.json (текущие настройки)
                        if theme != "settings" {
                            themes.push(theme);
                        }
                    }
                    // Пользовательские темы: settings-theme-{name}.json
                    if name.starts_with("settings-theme-") && name.ends_with(".json") {
                        let theme = name
                            .trim_start_matches("settings-theme-")
                            .trim_end_matches(".json")
                            .to_string();
                        themes.push(theme);
                    }
                }
            }
        }
    }
    themes.retain(|t| t != "dark" && t != "light");
    Ok(themes)
}

/// Load a theme by name from `data/settings-<theme>.json`.
#[tauri::command]
pub async fn load_theme(theme: String) -> Result<Value, String> {
    let data_dir = get_data_dir();
    // Сначала ищем булт-ин тему (напр.: settings-light.json)
    let builtin_path = data_dir.join(format!("settings-{}.json", theme));
    if builtin_path.exists() {
        let content = fs::read_to_string(&builtin_path).map_err(|e| e.to_string())?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    // Затем ищем пользовательскую тему (settings-theme-{name}.json)
    let custom_path = data_dir.join(format!("settings-theme-{}.json", theme));
    if custom_path.exists() {
        let content = fs::read_to_string(&custom_path).map_err(|e| e.to_string())?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    Ok(Value::Null)
}

/// Save a custom theme to `data/settings-<name>.json`.
#[tauri::command]
pub async fn save_custom_theme(name: String, settings: Value) -> Result<(), String> {
    let path = get_data_dir();
    fs::create_dir_all(&path).ok();
    let file_path = path.join(format!("settings-theme-{}.json", name));
    fs::write(&file_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}
