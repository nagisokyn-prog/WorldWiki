//! Интеграционный тестовый стенд для tauri_shell.
//!
//! Предоставляет:
//! - Изолированные временные каталоги data/ для каждого теста
//! - Helper функции для работы с файлами, темами, настройками
//! - Tauri mock app с зарегистрированными системными командами
//! - Гарантированную очистку после теста через RAII (TempDir)

use std::path::PathBuf;
use std::sync::Arc;
use tempfile::TempDir;
use tauri_shell::logic::system::DataDirProvider;

/// Тестовый провайдер data_dir, использующий TestEnv
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
    /// Создает новое изолированное окружение И регистрирует его как data_dir провайдер
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let data_dir = temp_dir.path().join("data");
        let user_images_dir = data_dir.join("user_images");

        std::fs::create_dir_all(&data_dir)?;
        std::fs::create_dir_all(&user_images_dir)?;

        // Регистрируем провайдер ДО создания TestApp
        let provider = Box::new(TestDataDirProvider::new(data_dir.clone()));
        tauri_shell::logic::system::set_data_dir_provider(provider);

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

    /// Получить путь к теме (встроенная или пользовательская)
    pub fn theme_path(&self, name: &str) -> PathBuf {
        if name.starts_with("theme-") {
            self.data_dir.join(format!("settings-{}.json", name))
        } else {
            self.data_dir.join(format!("settings-theme-{}.json", name))
        }
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
        for entry in std::fs::read_dir(&self.user_images_dir)? {
            if let Ok(entry) = entry {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_file() {
                        if let Some(name) = entry.file_name().into_string().ok() {
                            files.push(name);
                        }
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

/// Tauri mock application с зарегистрированными системными командами
pub struct TestApp {
    pub app: tauri::App<tauri::test::MockRuntime>,
    pub env: Arc<TestEnv>,
}

impl TestApp {
    /// Создаёт mock app через builder с полной регистрацией команд
    pub fn with_commands() -> (tauri::App<tauri::test::MockRuntime>, Arc<TestEnv>) {
        let env = Arc::new(TestEnv::new().expect("Failed to create TestEnv"));

        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![
                tauri_shell::logic::system::upload_photo,
                tauri_shell::logic::system::copy_background_file,
                tauri_shell::logic::system::get_local_file,
                tauri_shell::logic::system::run_performance_benchmark,
                tauri_shell::logic::system::get_performance_styles,
                tauri_shell::logic::system::save_settings,
                tauri_shell::logic::system::load_settings,
                tauri_shell::logic::system::toggle_fullscreen,
                tauri_shell::logic::system::get_custom_themes,
                tauri_shell::logic::system::load_theme,
                tauri_shell::logic::system::save_custom_theme,
            ])
            .build()
            .expect("Failed to build mock app");

        (app, env)
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
        
        let builtin_path = env.theme_path("theme-light");
        assert!(builtin_path.to_string_lossy().contains("settings-theme-light.json"));

        let custom_path = env.theme_path("custom");
        assert!(custom_path.to_string_lossy().contains("settings-theme-custom.json"));
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
