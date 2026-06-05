use serde_json::Value;
use std::env;
use std::fs;

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

#[tauri::command]
pub async fn get_local_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

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

#[tauri::command]
pub async fn save_settings(settings: Value) -> Result<(), String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("settings.json");
    fs::write(&path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

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

#[tauri::command]
pub async fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_custom_themes() -> Result<Vec<String>, String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data");
    if !path.exists() {
        return Ok(vec![]);
    }

    let mut themes = Vec::new();
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("settings-") && name.ends_with(".json") {
                        let theme_name = name
                            .trim_start_matches("settings-")
                            .trim_end_matches(".json")
                            .to_string();
                        // Ignore builtin standard themes from the custom list
                        if theme_name != "light" && theme_name != "dark" {
                            themes.push(theme_name);
                        }
                    }
                }
            }
        }
    }
    Ok(themes)
}

#[tauri::command]
pub async fn load_theme(theme: String) -> Result<Value, String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join(format!("settings-{}.json", theme));

    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(serde_json::from_str(&content).unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

#[tauri::command]
pub async fn save_custom_theme(name: String, settings: Value) -> Result<(), String> {
    let path = env::current_dir()
        .unwrap_or_default()
        .join("data");
    fs::create_dir_all(&path).ok();

    let file_path = path.join(format!("settings-{}.json", name));
    fs::write(&file_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}
