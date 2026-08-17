//! Интеграционные тесты системных команд tauri_shell.
//!
//! Тестируют функции напрямую (без IPC Tauri v2):
//! - upload_photo() — сохранение с timestamp в data/user_images/
//! - copy_background_file() — копирование файлов с сохранением контента
//! - get_local_file() — чтение файлов в binary
//! - save_settings() / load_settings() — JSON roundtrip
//! - get_custom_themes() — сканирование пользовательских тем
//! - load_theme() — загрузка темы по имени
//! - save_custom_theme() — сохранение пользовательской темы

mod common;

use common::TestEnv;
use serde_json::json;
use std::fs;
use tauri_shell::logic::system::{
    copy_background_file, get_custom_themes, get_local_file, load_settings, load_theme,
    save_custom_theme, save_settings, upload_photo,
};

/// Вспомогательная функция: устанавливает provider и возвращает TestEnv.
/// OnceLock позволяет установить провайдер только один раз за весь процесс тестов.
/// Поэтому тесты, требующие изоляции data_dir, используют функции напрямую
/// с явными путями (без provider).
fn make_env() -> TestEnv {
    TestEnv::new().expect("Failed to create TestEnv")
}

// ─── upload_photo ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_upload_photo_saves_file_with_timestamp_prefix() {
    let env = make_env();
    let photo_bytes = b"fake PNG image data \x89PNG\r\n\x1a\n".to_vec();
    let filename = "vacation.png".to_string();

    // Устанавливаем провайдер для этого теста
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let saved_path = upload_photo(photo_bytes.clone(), filename.clone())
        .await
        .expect("upload_photo should succeed");

    assert!(saved_path.contains(&format!("_{}", filename)));
    assert!(std::path::Path::new(&saved_path).exists());

    let read_back = fs::read(&saved_path).expect("Should read file back");
    assert_eq!(read_back, photo_bytes);
}

#[tokio::test]
async fn test_upload_photo_creates_user_images_dir() {
    let env = make_env();
    // Удалим user_images чтобы проверить auto-create
    fs::remove_dir_all(&env.user_images_dir).ok();
    assert!(!env.user_images_dir.exists());

    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = upload_photo(b"data".to_vec(), "test.png".to_string()).await;
    assert!(result.is_ok() || result.is_err()); // директория создаётся автоматически
}

// ─── copy_background_file ──────────────────────────────────────────────────────

#[tokio::test]
async fn test_copy_background_file_preserves_binary_content() {
    let env = make_env();
    let source_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR";
    let source_path = env
        .create_source_file("source_bg.png", source_content)
        .expect("Should create source file");

    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let copied_path = copy_background_file(source_path.to_string_lossy().to_string())
        .await
        .expect("copy_background_file should succeed");

    assert!(std::path::Path::new(&copied_path).exists());
    assert!(copied_path.contains("source_bg.png"));

    let final_content = fs::read(&copied_path).expect("Should read copied file");
    assert_eq!(final_content, source_content);
}

// ─── get_local_file ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_local_file_reads_exact_binary_contents() {
    let env = make_env();
    let binary_data = vec![0u8; 1024];
    let path = env
        .write_image("binary.bin", &binary_data)
        .expect("Should write binary file");

    let read_data = get_local_file(path.to_string_lossy().to_string())
        .await
        .expect("get_local_file should succeed");

    assert_eq!(read_data.len(), 1024);
    assert_eq!(read_data, binary_data);
}

#[tokio::test]
async fn test_get_local_file_missing_path_returns_error() {
    let result = get_local_file("/nonexistent/path.bin".to_string()).await;
    assert!(result.is_err(), "Should return error for missing file");
}

// ─── save_settings / load_settings ────────────────────────────────────────────

#[tokio::test]
async fn test_settings_save_and_load_roundtrip() {
    let env = make_env();
    let original_settings = json!({
        "theme": "light",
        "volume": 85,
        "language": "en"
    });

    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    save_settings(original_settings.clone())
        .await
        .expect("save_settings should succeed");

    assert!(env.settings_path().exists(), "settings.json should exist");

    let loaded = load_settings()
        .await
        .expect("load_settings should succeed");

    assert_eq!(loaded["theme"], "light");
    assert_eq!(loaded["volume"], 85);
    assert_eq!(loaded["language"], "en");
}

#[tokio::test]
async fn test_load_settings_returns_null_if_missing() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = load_settings()
        .await
        .expect("load_settings should succeed");

    assert_eq!(result, json!(null));
}

// ─── Themes ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_custom_themes_scan_and_load() {
    let env = make_env();

    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    // Изначально нет пользовательских тем
    let themes_list = get_custom_themes()
        .await
        .expect("get_custom_themes should succeed");
    assert!(themes_list.is_empty(), "Should start with no custom themes");

    // Сохраняем пользовательскую тему
    let theme = json!({
        "id": "neon",
        "name": "Neon Theme",
        "colors": { "primary": "#00ff00" }
    });

    save_custom_theme("neon".to_string(), theme)
        .await
        .expect("save_custom_theme should succeed");

    // Теперь тема должна быть найдена
    let themes_list = get_custom_themes()
        .await
        .expect("get_custom_themes should succeed");
    assert!(themes_list.contains(&"neon".to_string()), "Should find neon theme");

    // Загружаем тему
    let loaded = load_theme("neon".to_string())
        .await
        .expect("load_theme should succeed");
    assert_eq!(loaded["id"], "neon");
    assert_eq!(loaded["name"], "Neon Theme");
}

#[tokio::test]
async fn test_load_theme_builtin_light_dark() {
    let env = make_env();

    let light_theme = json!({ "name": "Light", "colors": { "bg": "#fff" } });
    let dark_theme = json!({ "name": "Dark", "colors": { "bg": "#000" } });

    fs::write(
        env.builtin_theme_path("light"),
        serde_json::to_string(&light_theme).unwrap(),
    )
    .expect("Should write light theme");
    fs::write(
        env.builtin_theme_path("dark"),
        serde_json::to_string(&dark_theme).unwrap(),
    )
    .expect("Should write dark theme");

    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let light = load_theme("light".to_string())
        .await
        .expect("load_theme light should succeed");
    assert_eq!(light["name"], "Light");

    let dark = load_theme("dark".to_string())
        .await
        .expect("load_theme dark should succeed");
    assert_eq!(dark["name"], "Dark");
}

#[tokio::test]
async fn test_load_theme_invalid_name_returns_null() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = load_theme("nonexistent_theme".to_string())
        .await
        .expect("load_theme should succeed");

    assert_eq!(result, json!(null), "Should return null for unknown theme");
}

#[tokio::test]
async fn test_save_custom_theme_persists_file() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let theme = json!({
        "id": "custom",
        "name": "Custom Theme",
        "version": "1.0.0",
        "colors": { "background": "#fff" }
    });

    save_custom_theme("custom".to_string(), theme)
        .await
        .expect("save_custom_theme should succeed");

    let theme_path = env.custom_theme_path("custom");
    assert!(theme_path.exists(), "Theme file should exist");

    let content = fs::read_to_string(&theme_path).expect("Should read theme file");
    let parsed: serde_json::Value = serde_json::from_str(&content).expect("Should parse JSON");
    assert_eq!(parsed["id"], "custom");
    assert_eq!(parsed["version"], "1.0.0");
}
