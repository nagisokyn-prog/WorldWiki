use crate::logic::error::SystemError;
use crate::logic::system_core::get_data_dir;
use serde_json::Value;
use std::fs;
use std::path::Path;

pub type ThemeList = Vec<String>;

use super::builtin_themes::{BUILTIN_DARK, BUILTIN_LIGHT};

fn scan_themes_dir(themes_dir: &Path, themes: &mut Vec<String>) {
    if !themes_dir.exists() {
        return;
    }
    let Ok(entries) = fs::read_dir(themes_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(ft) = entry.file_type() else { continue };
        if !ft.is_file() { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(t) = name.strip_suffix(".theme.json") {
            themes.push(t.to_string());
        } else if let Some(t) = name.strip_suffix(".json") {
            themes.push(t.to_string());
        }
    }
}

fn scan_legacy_themes(data_dir: &Path, themes: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(data_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(ft) = entry.file_type() else { continue };
        if !ft.is_file() { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("settings-") && name.ends_with(".json") && !name.starts_with("settings-theme-") {
            let theme = name.trim_start_matches("settings-").trim_end_matches(".json").to_string();
            if theme != "settings" && !themes.contains(&theme) {
                themes.push(theme);
            }
        }
        if name.starts_with("settings-theme-") && name.ends_with(".json") {
            let theme = name.trim_start_matches("settings-theme-").trim_end_matches(".json").to_string();
            if !themes.contains(&theme) {
                themes.push(theme);
            }
        }
    }
}

fn try_read_theme_file(path: &Path) -> Result<Option<Value>, SystemError> {
    if !path.exists() {
        return Ok(None);
    }
    if path.is_dir() {
        return Err(SystemError::OperationFailed(format!("{} is a directory", path.display())));
    }
    let content = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&content).unwrap_or(Value::Null)))
}

/// List all custom themes stored in data/themes/ or data/settings-theme-<name>.json
pub async fn get_custom_themes_core() -> Result<ThemeList, SystemError> {
    let data_dir = get_data_dir();
    if !data_dir.exists() {
        return Ok(vec![]);
    }
    let mut themes = Vec::new();
    scan_themes_dir(&data_dir.join("themes"), &mut themes);
    scan_legacy_themes(&data_dir, &mut themes);
    themes.retain(|t| t != "dark" && t != "light");
    themes.sort();
    themes.dedup();
    Ok(themes)
}

/// Load a theme by name from builtin, data/themes/, data/settings-<theme>.json or data/settings-theme-<theme>.json
pub async fn load_theme_core(theme: String) -> Result<Value, SystemError> {
    let data_dir = get_data_dir();
    let themes_dir = data_dir.join("themes");

    let candidate_paths = [
        data_dir.join(format!("settings-{}.json", theme)),
        themes_dir.join(format!("{}.theme.json", theme)),
        themes_dir.join(format!("{}.json", theme)),
        data_dir.join(format!("settings-theme-{}.json", theme)),
    ];

    for path in &candidate_paths {
        if let Some(val) = try_read_theme_file(path)? {
            return Ok(val);
        }
    }

    if theme == "dark" {
        return Ok(serde_json::from_str(BUILTIN_DARK).unwrap_or(Value::Null));
    }
    if theme == "light" {
        return Ok(serde_json::from_str(BUILTIN_LIGHT).unwrap_or(Value::Null));
    }

    Ok(Value::Null)
}

/// Save a custom theme to data/themes/<name>.theme.json and data/settings-theme-<name>.json
pub async fn save_custom_theme_core(name: String, settings: Value) -> Result<(), SystemError> {
    let data_dir = get_data_dir();
    let themes_dir = data_dir.join("themes");
    fs::create_dir_all(&themes_dir)?;

    let theme_file = themes_dir.join(format!("{}.theme.json", name));
    let serialized = serde_json::to_string_pretty(&settings)?;
    fs::write(&theme_file, &serialized)?;

    let legacy_file = data_dir.join(format!("settings-theme-{}.json", name));
    fs::write(&legacy_file, &serialized)?;

    Ok(())
}
