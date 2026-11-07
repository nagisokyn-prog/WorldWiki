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

/// Вычисляет путь к data/ на основе опциональной переменной окружения и пути исполняемого файла.
pub fn resolve_data_dir_path(custom_env: Option<&str>, exe_path: Option<&std::path::Path>) -> PathBuf {
    if let Some(custom_dir) = custom_env
        && !custom_dir.is_empty()
    {
        return PathBuf::from(custom_dir);
    }
    if let Some(exe) = exe_path {
        let mut curr = exe.parent();
        while let Some(dir) = curr {
            if dir.file_name().map(|n| n == "target").unwrap_or(false)
                && let Some(root) = dir.parent()
            {
                return root.join("data");
            }
            curr = dir.parent();
        }
    }
    // Prod or fallback
    env::current_dir().unwrap_or_default().join("data")
}

/// Дефолтный провайдер: ищет `target/.../data` (dev) или `cwd/data` (prod).
#[derive(Debug)]
pub struct DefaultDataDirProvider;

impl DataDirProvider for DefaultDataDirProvider {
    fn get_data_dir(&self) -> PathBuf {
        let custom = env::var("SURREAL_DATA_DIR").ok();
        let exe = env::current_exe().ok();
        resolve_data_dir_path(custom.as_deref(), exe.as_deref())
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
    let parent = path.parent().unwrap_or_else(|| std::path::Path::new(""));
    fs::create_dir_all(parent)?;
    let serialized = serde_json::to_string_pretty(&settings).unwrap_or_else(|_| "{}".to_string());
    fs::write(&path, serialized)?;
    Ok(())
}

/// Load app settings JSON from data/settings.json
pub async fn load_settings_core() -> Result<Value, SystemError> {
    let path = get_data_dir().join("settings.json");
    if path.exists() {
        let content = fs::read_to_string(&path)?;
        let settings = serde_json::from_str(&content).unwrap_or_else(|err| {
            tracing::warn!("Failed to parse settings JSON from {}: {err}. Falling back to default null.", path.display());
            Value::Null
        });
        Ok(settings)
    } else {
        Ok(Value::Null)
    }
}

// Re-export theme operations
pub use crate::logic::theme::*;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_resolve_data_dir_path_variations() {
        // 1. Valid custom env
        let p1 = resolve_data_dir_path(Some("/custom/data"), None);
        assert_eq!(p1, PathBuf::from("/custom/data"));

        // 2. Empty custom env falls through
        let p2 = resolve_data_dir_path(Some(""), Some(Path::new("/workspace/project/target/debug/app")));
        assert_eq!(p2, PathBuf::from("/workspace/project/data"));

        // 3. Exe path containing target directory
        let p3 = resolve_data_dir_path(None, Some(Path::new("/home/user/code/target/release/binary")));
        assert_eq!(p3, PathBuf::from("/home/user/code/data"));

        // 4. Exe path without target directory
        let p4 = resolve_data_dir_path(None, Some(Path::new("/usr/local/bin/app")));
        assert_eq!(p4, env::current_dir().unwrap_or_default().join("data"));

        // 5. Exe path None
        let p5 = resolve_data_dir_path(None, None);
        assert_eq!(p5, env::current_dir().unwrap_or_default().join("data"));
    }

    #[tokio::test]
    async fn test_upload_photo_core_negative_io_error() {
        let temp = tempfile::TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        set_data_dir_provider(Box::new(TestProvider(data_dir.clone())));

        let err = upload_photo_core(vec![1, 2, 3], "nonexistent_sub/dir/img.png".to_string()).await;
        assert!(err.is_err(), "upload with invalid path should return Err");

        clear_data_dir_provider();
    }

    #[tokio::test]
    async fn test_copy_background_file_core_negative_create_dir_err() {
        let temp = tempfile::TempDir::new().unwrap();
        let data_dir = temp.path().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        let file_blocking_dir = data_dir.join("user_images");
        fs::write(&file_blocking_dir, b"block").unwrap();

        set_data_dir_provider(Box::new(TestProvider(data_dir)));

        let err = copy_background_file_core("dummy.png".to_string()).await;
        assert!(err.is_err(), "copy when user_images is a file should return Err");

        clear_data_dir_provider();
    }

    #[tokio::test]
    async fn test_save_settings_core_negative_parent_dir_err() {
        let temp = tempfile::TempDir::new().unwrap();
        let file_blocking_data = temp.path().join("data_file");
        fs::write(&file_blocking_data, b"block").unwrap();

        set_data_dir_provider(Box::new(TestProvider(file_blocking_data.join("nested"))));

        let err = save_settings_core(serde_json::json!({"test": 1})).await;
        assert!(err.is_err(), "save_settings when parent is blocked should return Err");

        clear_data_dir_provider();
    }

    #[derive(Debug)]
    struct TestProvider(PathBuf);
    impl DataDirProvider for TestProvider {
        fn get_data_dir(&self) -> PathBuf {
            self.0.clone()
        }
    }
}

