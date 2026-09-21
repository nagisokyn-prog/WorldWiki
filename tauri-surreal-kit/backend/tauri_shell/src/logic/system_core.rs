use crate::logic::error::SystemError;
use serde_json::Value;
use std::cell::RefCell;
use std::env;
use std::fs;
use std::path::PathBuf;

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
        if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR") {
            if !custom_dir.is_empty() {
                return PathBuf::from(custom_dir);
            }
        }
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

thread_local! {
    static LOCAL_DATA_DIR_PROVIDER: RefCell<Option<Box<dyn DataDirProvider>>> = const { RefCell::new(None) };
}

/// Установить кастомный провайдер для текущего потока (для тестов).
pub fn set_data_dir_provider(provider: Box<dyn DataDirProvider>) {
    LOCAL_DATA_DIR_PROVIDER.with(|cell| {
        *cell.borrow_mut() = Some(provider);
    });
}

/// Сбросить провайдер к дефолтному для текущего потока.
pub fn clear_data_dir_provider() {
    LOCAL_DATA_DIR_PROVIDER.with(|cell| {
        *cell.borrow_mut() = None;
    });
}

/// Получить каталог данных через активный провайдер.
pub fn get_data_dir() -> PathBuf {
    LOCAL_DATA_DIR_PROVIDER.with(|cell| {
        if let Some(ref provider) = *cell.borrow() {
            return provider.get_data_dir();
        }
        DefaultDataDirProvider.get_data_dir()
    })
}

static FILE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Upload photo bytes and save to data/user_images/
pub async fn upload_photo_core(bytes: Vec<u8>, filename: String) -> Result<String, SystemError> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path)?;
    let count = FILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let new_name = format!(
        "{}_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| SystemError::OperationFailed(e.to_string()))?
            .as_millis(),
        count,
        filename
    );
    path.push(new_name);
    fs::write(&path, bytes)?;
    Ok(path.to_string_lossy().to_string())
}

/// Copy background file from absolute path -> saves to data/user_images/
pub async fn copy_background_file_core(source_path: String) -> Result<String, SystemError> {
    let mut path = get_data_dir().join("user_images");
    fs::create_dir_all(&path)?;

    let source = std::path::Path::new(&source_path);
    let filename = source.file_name().unwrap_or_default().to_string_lossy();

    let count = FILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let new_name = format!(
        "{}_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| SystemError::OperationFailed(e.to_string()))?
            .as_millis(),
        count,
        filename
    );
    path.push(new_name);
    fs::copy(&source_path, &path)?;
    Ok(path.to_string_lossy().to_string())
}

/// Read a local file and return its bytes
pub async fn get_local_file_core(path: String) -> Result<Vec<u8>, SystemError> {
    let bytes = fs::read(&path)?;
    Ok(bytes)
}

/// Persist app settings JSON to data/settings.json
pub async fn save_settings_core(settings: Value) -> Result<(), SystemError> {
    let path = get_data_dir().join("settings.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_string_pretty(&settings)?;
    fs::write(&path, serialized)?;
    Ok(())
}

/// Load app settings JSON from data/settings.json
pub async fn load_settings_core() -> Result<Value, SystemError> {
    let path = get_data_dir().join("settings.json");
    if path.exists() {
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content).unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

// Re-export theme operations
pub use crate::logic::theme::*;

