//! Интеграционный тестовый стенд для tauri_shell.
//!
//! Предоставляет:
//! - Изолированные временные каталоги data/ для каждого теста
//! - Helper функции для работы с файлами, темами, настройками
//! - Гарантированную очистку после теста через RAII (TempDir)
//!
//! NOTE: Tauri v2 не предоставляет app.invoke() — команды тестируются
//! напрямую как обычные async-функции через DataDirProvider.

use std::path::PathBuf;
use tempfile::TempDir;
use tauri_shell::logic::system::DataDirProvider;

/// Тестовый провайдер data_dir
#[derive(Debug)]
pub struct TestDataDirProvider {
    data_dir: PathBuf,
}

impl TestDataDirProvider {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { data_dir }
    }
}

impl DataDirProvider for TestDataDirProvider {
    fn get_data_dir(&self) -> PathBuf {
        self.data_dir.clone()
    }
}

/// Тестовое окружение с изолированным временным каталогом data/
pub struct TestEnv {
    /// Корень временного каталога (автоматически удаляется при drop)
    pub temp_dir: TempDir,
    /// Путь к data/
    pub data_dir: PathBuf,
    /// Путь к data/user_images/
    pub user_images_dir: PathBuf,
}

impl TestEnv {
    /// Создает новое изолированное окружение.
    ///
    /// ВАЖНО: DataDirProvider глобальный (OnceLock). Для тестов,
    /// которым нужен провайдер, используй `new_with_provider()`.
    /// Остальные тесты работают с data_dir напрямую через пути.
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let data_dir = temp_dir.path().join("data");
        let user_images_dir = data_dir.join("user_images");

        std::fs::create_dir_all(&data_dir)?;
        std::fs::create_dir_all(&user_images_dir)?;

        Ok(TestEnv {
            temp_dir,
            data_dir,
            user_images_dir,
        })
    }

    /// Получить путь к settings.json
    pub fn settings_path(&self) -> PathBuf {
        self.data_dir.join("settings.json")
    }

    /// Получить путь к файлу темы по имени.
    /// Встроенные: settings-{name}.json
    /// Пользовательские: settings-theme-{name}.json
    pub fn builtin_theme_path(&self, name: &str) -> PathBuf {
        self.data_dir.join(format!("settings-{}.json", name))
    }

    pub fn custom_theme_path(&self, name: &str) -> PathBuf {
        self.data_dir.join(format!("settings-theme-{}.json", name))
    }

    /// Записать тестовый файл в user_images/
    pub fn write_image(&self, filename: &str, content: &[u8]) -> std::io::Result<PathBuf> {
        let path = self.user_images_dir.join(filename);
        std::fs::write(&path, content)?;
        Ok(path)
    }

    /// Прочитать файл из user_images/
    pub fn read_image(&self, filename: &str) -> std::io::Result<Vec<u8>> {
        std::fs::read(self.user_images_dir.join(filename))
    }

    /// Список всех файлов в user_images/
    pub fn list_images(&self) -> std::io::Result<Vec<String>> {
        let mut files = Vec::new();
        for entry in std::fs::read_dir(&self.user_images_dir)?.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    if let Ok(name) = entry.file_name().into_string() {
                        files.push(name);
                    }
                }
            }
        }
        Ok(files)
    }

    /// Создать исходный файл вне data/ для copy_background_file
    pub fn create_source_file(&self, filename: &str, content: &[u8]) -> std::io::Result<PathBuf> {
        let source_dir = self.temp_dir.path().join("sources");
        std::fs::create_dir_all(&source_dir)?;
        let path = source_dir.join(filename);
        std::fs::write(&path, content)?;
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_creates_temp_directory() {
        let env = TestEnv::new().expect("Should create TestEnv");
        assert!(env.data_dir.exists(), "data_dir should exist");
        assert!(env.user_images_dir.exists(), "user_images_dir should exist");
    }

    #[test]
    fn test_env_write_and_read_image() {
        let env = TestEnv::new().expect("Should create TestEnv");
        let content = b"fake image data";
        let path = env
            .write_image("test.png", content)
            .expect("Should write file");

        assert!(path.exists(), "File should exist");

        let read_content = env.read_image("test.png").expect("Should read file");
        assert_eq!(read_content, content);
    }

    #[test]
    fn test_env_list_images() {
        let env = TestEnv::new().expect("Should create TestEnv");
        env.write_image("photo1.jpg", b"photo1")
            .expect("Should write photo1");
        env.write_image("photo2.jpg", b"photo2")
            .expect("Should write photo2");

        let files = env.list_images().expect("Should list files");
        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|f| f.contains("photo1")));
        assert!(files.iter().any(|f| f.contains("photo2")));
    }

    #[test]
    fn test_env_theme_paths() {
        let env = TestEnv::new().expect("Should create TestEnv");

        let builtin = env.builtin_theme_path("light");
        assert!(builtin.to_string_lossy().contains("settings-light.json"));

        let custom = env.custom_theme_path("my-theme");
        assert!(custom.to_string_lossy().contains("settings-theme-my-theme.json"));
    }

    #[test]
    fn test_env_create_source_file() {
        let env = TestEnv::new().expect("Should create TestEnv");
        let source = env
            .create_source_file("source.bg", b"background data")
            .expect("Should create source file");

        assert!(source.exists());
        assert!(source.to_string_lossy().contains("sources"));
    }

    #[test]
    fn test_testdatadirprovider_returns_correct_path() {
        let env = TestEnv::new().expect("Should create TestEnv");
        let provider = TestDataDirProvider::new(env.data_dir.clone());
        assert_eq!(provider.get_data_dir(), env.data_dir);
    }
}
