use crate::logic::error::SystemError;
use crate::logic::system_core::get_data_dir;
use serde_json::Value;
use std::fs;

pub type ThemeList = Vec<String>;

const BUILTIN_DARK: &str = r##"{
  "id": "dark",
  "name": "Темная",
  "isBuiltin": true,
  "colors": {
    "bgBase": "#09090b",
    "bgSecondary": "#121214",
    "bgPanel": "rgba(15, 15, 18, 0.7)",
    "bgCard": "rgba(22, 22, 26, 0.6)",
    "bgInput": "rgba(22, 22, 26, 0.6)",
    "bgSunken": "rgba(0, 0, 0, 0.25)",
    "bgHover": "rgba(255, 255, 255, 0.05)",
    "bgActive": "rgba(255, 255, 255, 0.1)",
    "bgSelected": "rgba(139, 92, 246, 0.15)",
    "textMain": "#ffffff",
    "textHeading": "#ffffff",
    "textMuted": "rgba(255, 255, 255, 0.65)",
    "textDisabled": "rgba(255, 255, 255, 0.35)",
    "accent": "#8b5cf6",
    "accentHover": "#7c3aed",
    "accentActive": "#6d28d9",
    "accentDisabled": "#4c1d95",
    "accentGlow": "rgba(139, 92, 246, 0.3)",
    "accentText": "#ffffff",
    "borderColor": "rgba(255, 255, 255, 0.1)",
    "borderHover": "rgba(255, 255, 255, 0.2)",
    "borderActive": "rgba(139, 92, 246, 0.5)",
    "shadowColor": "rgba(0, 0, 0, 0.5)"
  },
  "glass": {
    "cardAlpha": 0.6,
    "islandAlpha": 0.7,
    "blur": 24,
    "borderAlpha": 0.12,
    "highlight": "rgba(255, 255, 255, 0.08)"
  }
}"##;

const BUILTIN_LIGHT: &str = r##"{
  "id": "light",
  "name": "Светлая",
  "isBuiltin": true,
  "colors": {
    "bgBase": "#f8fafc",
    "bgSecondary": "#f1f5f9",
    "bgPanel": "rgba(241, 245, 249, 0.8)",
    "bgCard": "rgba(255, 255, 255, 0.85)",
    "bgInput": "rgba(241, 245, 249, 0.9)",
    "bgSunken": "rgba(0, 0, 0, 0.05)",
    "bgHover": "rgba(0, 0, 0, 0.04)",
    "bgActive": "rgba(0, 0, 0, 0.08)",
    "bgSelected": "rgba(124, 58, 237, 0.12)",
    "textMain": "#0f172a",
    "textHeading": "#0f172a",
    "textMuted": "rgba(15, 23, 42, 0.65)",
    "textDisabled": "rgba(15, 23, 42, 0.35)",
    "accent": "#7c3aed",
    "accentHover": "#6d28d9",
    "accentActive": "#5b21b6",
    "accentDisabled": "#c4b5fd",
    "accentGlow": "rgba(124, 58, 237, 0.2)",
    "accentText": "#ffffff",
    "borderColor": "rgba(15, 23, 42, 0.1)",
    "borderHover": "rgba(15, 23, 42, 0.2)",
    "borderActive": "rgba(124, 58, 237, 0.5)",
    "shadowColor": "rgba(0, 0, 0, 0.15)"
  },
  "glass": {
    "cardAlpha": 0.85,
    "islandAlpha": 0.8,
    "blur": 20,
    "borderAlpha": 0.15,
    "highlight": "rgba(0, 0, 0, 0.04)"
  }
}"##;

/// List all custom themes stored in data/themes/ or data/settings-theme-<name>.json
pub async fn get_custom_themes_core() -> Result<ThemeList, SystemError> {
    let data_dir = get_data_dir();
    if !data_dir.exists() {
        return Ok(vec![]);
    }
    let mut themes = Vec::new();

    // 1. Проверяем директорию data/themes/*.theme.json и *.json
    let themes_dir = data_dir.join("themes");
    if themes_dir.exists() {
        if let Ok(entries) = fs::read_dir(&themes_dir) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_file() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if let Some(t) = name.strip_suffix(".theme.json") {
                            themes.push(t.to_string());
                        } else if let Some(t) = name.strip_suffix(".json") {
                            themes.push(t.to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. Проверяем обратную совместимость в data/settings-theme-<name>.json и data/settings-<name>.json
    if let Ok(entries) = fs::read_dir(&data_dir) {
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
                        if theme != "settings" && !themes.contains(&theme) {
                            themes.push(theme);
                        }
                    }
                    if name.starts_with("settings-theme-") && name.ends_with(".json") {
                        let theme = name
                            .trim_start_matches("settings-theme-")
                            .trim_end_matches(".json")
                            .to_string();
                        if !themes.contains(&theme) {
                            themes.push(theme);
                        }
                    }
                }
            }
        }
    }
    themes.retain(|t| t != "dark" && t != "light");
    themes.sort();
    themes.dedup();
    Ok(themes)
}

/// Load a theme by name from builtin, data/themes/, data/settings-<theme>.json or data/settings-theme-<theme>.json
pub async fn load_theme_core(theme: String) -> Result<Value, SystemError> {
    let data_dir = get_data_dir();

    // 1. Проверяем встроенные пресеты в файловой системе и константах
    let builtin_path = data_dir.join(format!("settings-{}.json", theme));
    if builtin_path.exists() {
        if builtin_path.is_dir() {
            return Err(SystemError::OperationFailed(format!("{} is a directory", builtin_path.display())));
        }
        let content = fs::read_to_string(&builtin_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }

    let themes_dir = data_dir.join("themes");
    let theme_json_path = themes_dir.join(format!("{}.theme.json", theme));
    if theme_json_path.exists() {
        if theme_json_path.is_dir() {
            return Err(SystemError::OperationFailed(format!("{} is a directory", theme_json_path.display())));
        }
        let content = fs::read_to_string(&theme_json_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }

    let theme_plain_path = themes_dir.join(format!("{}.json", theme));
    if theme_plain_path.exists() {
        if theme_plain_path.is_dir() {
            return Err(SystemError::OperationFailed(format!("{} is a directory", theme_plain_path.display())));
        }
        let content = fs::read_to_string(&theme_plain_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }

    let custom_path = data_dir.join(format!("settings-theme-{}.json", theme));
    if custom_path.exists() {
        if custom_path.is_dir() {
            return Err(SystemError::OperationFailed(format!("{} is a directory", custom_path.display())));
        }
        let content = fs::read_to_string(&custom_path)?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }

    // Встроенные fallback
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

    // Для обратной совместимости сохраняем и старый формат
    let legacy_file = data_dir.join(format!("settings-theme-{}.json", name));
    let _ = fs::write(&legacy_file, &serialized);

    Ok(())
}

