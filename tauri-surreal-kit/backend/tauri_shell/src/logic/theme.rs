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
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }
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
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }
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
    let trimmed = content.trim_start_matches('\u{FEFF}').trim();
    if trimmed.is_empty() {
        return Ok(Some(Value::Null));
    }
    let theme = match serde_json::from_str(trimmed) {
        Ok(val) => val,
        Err(e) => {
            tracing::warn!("Failed to parse theme file {}: {}", path.display(), e);
            Value::Null
        }
    };
    Ok(Some(theme))
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
    let serialized = serde_json::to_string_pretty(&settings).unwrap_or_default();
    fs::write(&theme_file, &serialized)?;

    let legacy_file = data_dir.join(format!("settings-theme-{}.json", name));
    fs::write(&legacy_file, &serialized)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logic::system_core::{clear_data_dir_provider, set_data_dir_provider, DataDirProvider};
    use std::path::PathBuf;
    use tempfile::TempDir;

    #[derive(Debug)]
    struct TestProvider(PathBuf);
    impl DataDirProvider for TestProvider {
        fn get_data_dir(&self) -> PathBuf {
            self.0.clone()
        }
    }

    #[tokio::test]
    async fn test_theme_operations_all_branches() {
        let temp = TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        set_data_dir_provider(Box::new(TestProvider(data_dir.clone())));

        // 1. Line 105: load builtin light theme
        let light = load_theme_core("light".to_string()).await.unwrap();
        assert_ne!(light, Value::Null);

        // 2. Line 102: load builtin dark theme
        let dark = load_theme_core("dark".to_string()).await.unwrap();
        assert_ne!(dark, Value::Null);

        // 3. Scan themes dir with .json (line 25), .theme.json, non-json (notes.txt), and subdirectory (line 20)
        let themes_dir = data_dir.join("themes");
        fs::create_dir_all(&themes_dir).unwrap();
        fs::write(themes_dir.join("solarized.theme.json"), r#"{"bg": "blue"}"#).unwrap();
        fs::write(themes_dir.join("nord.json"), r#"{"bg": "nord_color"}"#).unwrap();
        fs::write(themes_dir.join("notes.txt"), b"ignore this file").unwrap();
        fs::create_dir_all(themes_dir.join("subfolder")).unwrap();

        // 4. Legacy themes: settings-legacy.json, settings-settings.json (line 42), settings-theme-cyber.json, other.txt
        fs::write(data_dir.join("settings-legacy.json"), r#"{"bg": "legacy_color"}"#).unwrap();
        fs::write(data_dir.join("settings-settings.json"), r#"{"bg": "settings_color"}"#).unwrap();
        fs::write(data_dir.join("settings-theme-cyber.json"), r#"{"bg": "cyber_color"}"#).unwrap();
        fs::write(data_dir.join("other.txt"), b"ignore").unwrap();
        fs::create_dir_all(data_dir.join("data_subfolder")).unwrap();

        let list = get_custom_themes_core().await.unwrap();
        assert!(list.contains(&"solarized".to_string()));
        assert!(list.contains(&"nord".to_string()));
        assert!(list.contains(&"legacy".to_string()));
        assert!(list.contains(&"cyber".to_string()));
        assert!(!list.contains(&"settings".to_string()));

        // Duplicate test for line 42 (when theme already in themes)
        fs::write(data_dir.join("settings-solarized.json"), r#"{"bg": "dup_color"}"#).unwrap();
        let list2 = get_custom_themes_core().await.unwrap();
        assert_eq!(list2.iter().filter(|&t| t == "solarized").count(), 1);

        // Line 107: nonexistent theme returns Null
        let non = load_theme_core("nonexistent_custom_xyz".to_string()).await.unwrap();
        assert_eq!(non, Value::Null);

        clear_data_dir_provider();
    }

    #[test]
    fn test_scan_themes_dir_when_file_returns_line_16() {
        let temp = TempDir::new().unwrap();
        let themes_file = temp.path().join("themes");
        fs::write(&themes_file, b"not a dir").unwrap();

        let mut themes = Vec::new();
        scan_themes_dir(&themes_file, &mut themes);
        assert!(themes.is_empty(), "scan_themes_dir on file should return immediately");
    }

    #[test]
    fn test_scan_legacy_themes_when_file_returns_line_32() {
        let temp = TempDir::new().unwrap();
        let data_file = temp.path().join("data");
        fs::write(&data_file, b"not a dir").unwrap();

        let mut themes = Vec::new();
        scan_legacy_themes(&data_file, &mut themes);
        assert!(themes.is_empty(), "scan_legacy_themes on file should return immediately");
    }

    #[tokio::test]
    async fn test_save_custom_theme_core_negative_branches_115_and_119() {
        let temp = TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();

        // Line 115: data/themes is a file, create_dir_all fails
        fs::write(data_dir.join("themes"), b"block").unwrap();
        set_data_dir_provider(Box::new(TestProvider(data_dir.clone())));

        let res1 = save_custom_theme_core("err1".to_string(), Value::Null).await;
        assert!(res1.is_err(), "save_custom_theme when themes is a file must fail");

        // Now remove blocking file, create themes dir
        fs::remove_file(data_dir.join("themes")).unwrap();
        let themes_dir = data_dir.join("themes");
        fs::create_dir_all(&themes_dir).unwrap();

        // Line 119: theme_file is an existing directory, fs::write fails
        fs::create_dir_all(themes_dir.join("dir_theme.theme.json")).unwrap();
        let res2 = save_custom_theme_core("dir_theme".to_string(), Value::Null).await;
        assert!(res2.is_err(), "save_custom_theme when theme file is a directory must fail");

        // Line 121: legacy_file is an existing directory, fs::write fails
        fs::remove_dir_all(themes_dir.join("dir_theme.theme.json")).ok();
        fs::create_dir_all(data_dir.join("settings-theme-dir_legacy.json")).unwrap();
        let res3 = save_custom_theme_core("dir_legacy".to_string(), Value::Null).await;
        assert!(res3.is_err(), "save_custom_theme when legacy file is directory must fail");

        clear_data_dir_provider();
    }

    #[tokio::test]
    async fn test_try_read_theme_file_is_directory() {
        let temp = TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        fs::create_dir_all(data_dir.join("settings-dirtheme.json")).unwrap();
        set_data_dir_provider(Box::new(TestProvider(data_dir)));

        let res = load_theme_core("dirtheme".to_string()).await;
        assert!(res.is_err(), "load_theme on directory must return Err");

        clear_data_dir_provider();
    }

    #[tokio::test]
    async fn test_try_read_theme_file_read_error() {
        let temp = TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        set_data_dir_provider(Box::new(TestProvider(data_dir.clone())));

        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            let locked_path = data_dir.join("settings-locked.json");
            let mut open_opts = std::fs::OpenOptions::new();
            open_opts.write(true);
            open_opts.create(true);
            open_opts.truncate(true);
            open_opts.share_mode(0);
            let _locked_file = open_opts.open(&locked_path).unwrap();
            let res = load_theme_core("locked".to_string()).await;
            assert!(res.is_err(), "reading locked file must return Err");
        }

        clear_data_dir_provider();
    }
}
