use serde_json::Value;
use std::env;
use std::fs;

// ─── File system ──────────────────────────────────────────────────────────────

/// Upload a photo/image bytes → saves to `data/user_images/` with a timestamp prefix.
/// Returns the absolute path of the saved file.
#[tauri::command]
pub async fn upload_photo(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let mut path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("user_images");
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
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("settings.json");
    fs::create_dir_all(path.parent().unwrap()).ok();
    fs::write(&path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Load app settings JSON from `data/settings.json`. Returns `null` if not found.
#[tauri::command]
pub async fn load_settings() -> Result<Value, String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("settings.json");
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
    let path = env::current_dir().unwrap_or_default().join("data");
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut themes = Vec::new();
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("settings-theme-") && name.ends_with(".json") {
                        let theme = name
                            .trim_start_matches("settings-theme-")
                            .trim_end_matches(".json")
                            .to_string();
                        if theme != "light" && theme != "dark" {
                            themes.push(theme);
                        }
                    }
                }
            }
        }
    }
    Ok(themes)
}

/// Load a theme by name from `data/settings-<theme>.json`.
#[tauri::command]
pub async fn load_theme(theme: String) -> Result<Value, String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join(format!("settings-theme-{}.json", theme)); // Fixed file name format here too to match main.rs
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(serde_json::from_str(&content).unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

/// Save a custom theme to `data/settings-<name>.json`.
#[tauri::command]
pub async fn save_custom_theme(name: String, settings: Value) -> Result<(), String> {
    let path = env::current_dir().unwrap_or_default().join("data");
    fs::create_dir_all(&path).ok();
    let file_path = path.join(format!("settings-{}.json", name));
    fs::write(&file_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}
