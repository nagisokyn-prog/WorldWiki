pub use crate::logic::system_core::*;
use serde_json::Value;

// ─── Tauri Command Handlers ───────────────────────────────────────────────────

/// Upload a photo/image bytes → saves to `data/user_images/` with a timestamp prefix.
#[tauri::command]
pub async fn upload_photo(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    upload_photo_core(bytes, filename).await
}

/// Copy a background file from absolute path -> saves to `data/user_images/`
#[tauri::command]
pub async fn copy_background_file(source_path: String) -> Result<String, String> {
    copy_background_file_core(source_path).await
}

/// Read a local file and return its bytes (used to serve local images to the webview).
#[tauri::command]
pub async fn get_local_file(path: String) -> Result<Vec<u8>, String> {
    get_local_file_core(path).await
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
    save_settings_core(settings).await
}

/// Load app settings JSON from `data/settings.json`. Returns `null` if not found.
#[tauri::command]
pub async fn load_settings() -> Result<Value, String> {
    load_settings_core().await
}

// ─── Window ───────────────────────────────────────────────────────────────────

/// Toggle fullscreen mode for the current Tauri window.
#[tauri::command]
pub async fn toggle_fullscreen<R: tauri::Runtime>(window: tauri::WebviewWindow<R>) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Themes ───────────────────────────────────────────────────────────────────

/// List all custom themes stored as `data/settings-<name>.json`
#[tauri::command]
pub async fn get_custom_themes() -> Result<Vec<String>, String> {
    get_custom_themes_core().await
}

/// Load a theme by name from `data/settings-<theme>.json`.
#[tauri::command]
pub async fn load_theme(theme: String) -> Result<Value, String> {
    load_theme_core(theme).await
}

/// Save a custom theme to `data/settings-<name>.json`.
#[tauri::command]
pub async fn save_custom_theme(name: String, settings: Value) -> Result<(), String> {
    save_custom_theme_core(name, settings).await
}

