use crate::logic::error::SystemError;
use crate::logic::system_core::get_data_dir;
use serde_json::Value;
use std::fs;

pub type ThemeList = Vec<String>;

/// List all custom themes stored as data/settings-<name>.json or data/settings-theme-<name>.json
pub async fn get_custom_themes_core() -> Result<ThemeList, SystemError> {
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
                    if name.starts_with("settings-")
                        && name.ends_with(".json")
                        && !name.starts_with("settings-theme-")
                    {
                        let theme = name
                            .trim_start_matches("settings-")
                            .trim_end_matches(".json")
                            .to_string();
                        if theme != "settings" {
                            themes.push(theme);
                        }
                    }
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

/// Load a theme by name from data/settings-<theme>.json or data/settings-theme-<theme>.json
pub async fn load_theme_core(theme: String) -> Result<Value, SystemError> {
    let data_dir = get_data_dir();
    let builtin_path = data_dir.join(format!("settings-{}.json", theme));
    if builtin_path.exists() {
        let content = fs::read_to_string(&builtin_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    let custom_path = data_dir.join(format!("settings-theme-{}.json", theme));
    if custom_path.exists() {
        let content = fs::read_to_string(&custom_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    Ok(Value::Null)
}

/// Save a custom theme to data/settings-theme-<name>.json
pub async fn save_custom_theme_core(name: String, settings: Value) -> Result<(), SystemError> {
    let path = get_data_dir();
    fs::create_dir_all(&path)?;
    let file_path = path.join(format!("settings-theme-{}.json", name));
    let serialized = serde_json::to_string_pretty(&settings)?;
    fs::write(&file_path, serialized)?;
    Ok(())
}
