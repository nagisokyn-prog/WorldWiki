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
pub struct DefaultDataDirProvider;

impl DataDirProvider for DefaultDataDirProvider {
    fn get_data_dir(&self) -> PathBuf {
        if let Ok(exe) = env::current_exe() {
            let mut curr = exe.parent();
            while let Some(dir) = curr {
                if dir.file_name().map(|n| n == "target").unwrap_or(false) {
                    if let Some(root) = dir.parent() {
                        return root.join("data");
                    }
                }
                curr = dir.parent();
            }
        }
        // Prod or fallback
        env::current_dir().unwrap_or_default().join("data")
    }
}

/// Глобальный провайдер (по умолчанию — DefaultDataDirProvider).
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
pub fn get_data_dir() -> PathBuf {
    if let Ok(lock) = DATA_DIR_PROVIDER.read() {
        if let Some(ref provider) = *lock {
            return provider.get_data_dir();
        }
    }
    DefaultDataDirProvider.get_data_dir()
}

static FILE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Upload photo bytes and save to data/user_images/
pub async fn upload_photo_core(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path).ok();
    let count = FILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let new_name = format!(
        "{}_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        count,
        filename
    );
    path.push(new_name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Copy background file from absolute path -> saves to data/user_images/
pub async fn copy_background_file_core(source_path: String) -> Result<String, String> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path).ok();

    let source = std::path::Path::new(&source_path);
    let filename = source.file_name().unwrap_or_default().to_string_lossy();

    let count = FILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let new_name = format!(
        "{}_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        count,
        filename
    );
    path.push(new_name);
    fs::copy(&source_path, &path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Read a local file and return its bytes
pub async fn get_local_file_core(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

/// Persist app settings JSON to data/settings.json
pub async fn save_settings_core(settings: Value) -> Result<(), String> {
    let path = get_data_dir().join("settings.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Load app settings JSON from data/settings.json
pub async fn load_settings_core() -> Result<Value, String> {
    let path = get_data_dir().join("settings.json");
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(serde_json::from_str(&content).unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

/// List all custom themes stored as data/settings-<name>.json
pub async fn get_custom_themes_core() -> Result<Vec<String>, String> {
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

/// Load a theme by name from data/settings-<theme>.json
pub async fn load_theme_core(theme: String) -> Result<Value, String> {
    let data_dir = get_data_dir();
    let builtin_path = data_dir.join(format!("settings-{}.json", theme));
    if builtin_path.exists() {
        let content = fs::read_to_string(&builtin_path).map_err(|e| e.to_string())?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    let custom_path = data_dir.join(format!("settings-theme-{}.json", theme));
    if custom_path.exists() {
        let content = fs::read_to_string(&custom_path).map_err(|e| e.to_string())?;
        return Ok(serde_json::from_str(&content).unwrap_or(Value::Null));
    }
    Ok(Value::Null)
}

/// Save a custom theme to data/settings-theme-<name>.json
pub async fn save_custom_theme_core(name: String, settings: Value) -> Result<(), String> {
    let path = get_data_dir();
    fs::create_dir_all(&path).ok();
    let file_path = path.join(format!("settings-theme-{}.json", name));
    fs::write(&file_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}
