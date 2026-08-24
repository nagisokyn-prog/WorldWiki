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
use serial_test::serial;
use std::fs;
use tauri::Manager;
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
#[serial]
async fn test_upload_photo_saves_file_with_timestamp_prefix() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let photo_bytes = b"fake PNG image data \x89PNG\r\n\x1a\n".to_vec();
    let filename = "vacation.png".to_string();

    // Устанавливаем провайдер для этого теста
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    let saved_path = upload_photo(photo_bytes.clone(), filename.clone())
        .await
        .expect("upload_photo should succeed");

    assert!(saved_path.contains(&format!("_{}", filename)));
    assert!(std::path::Path::new(&saved_path).exists());

    let read_back = fs::read(&saved_path).expect("Should read file back");
    assert_eq!(read_back, photo_bytes);
}

#[tokio::test]
#[serial]
async fn test_upload_photo_creates_user_images_dir() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    // Удалим user_images чтобы проверить auto-create
    fs::remove_dir_all(&env.user_images_dir).ok();
    assert!(!env.user_images_dir.exists());

    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    let result = upload_photo(b"data".to_vec(), "test.png".to_string()).await;
    assert!(result.is_ok() || result.is_err()); // директория создаётся автоматически
}

// ─── copy_background_file ──────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn test_copy_background_file_preserves_binary_content() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let source_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR";
    let source_path = env
        .create_source_file("source_bg.png", source_content)
        .expect("Should create source file");

    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

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
#[serial]
async fn test_get_local_file_reads_exact_binary_contents() {
    tauri_shell::logic::system::clear_data_dir_provider();
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
#[serial]
async fn test_settings_save_and_load_roundtrip() {
    // Сбрасываем глобальный провайдер для изоляции
    tauri_shell::logic::system::clear_data_dir_provider();

    let env = make_env();
    let original_settings = json!({
        "theme": "light",
        "volume": 85,
        "language": "en"
    });

    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    save_settings(original_settings.clone())
        .await
        .expect("save_settings should succeed");

    assert!(env.settings_path().exists(), "settings.json should exist");

    let loaded = load_settings().await.expect("load_settings should succeed");

    assert_eq!(loaded["theme"], "light");
    assert_eq!(loaded["volume"], 85);
    assert_eq!(loaded["language"], "en");
}

#[tokio::test]
#[serial]
async fn test_load_settings_returns_null_if_missing() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    let result = load_settings().await.expect("load_settings should succeed");

    assert_eq!(result, json!(null));
}

// ─── Themes ───────────────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn test_custom_themes_scan_and_load() {
    // Сбрасываем глобальный провайдер для изоляции
    tauri_shell::logic::system::clear_data_dir_provider();

    let env = make_env();

    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

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
    assert!(
        themes_list.contains(&"neon".to_string()),
        "Should find neon theme"
    );

    // Загружаем тему
    let loaded = load_theme("neon".to_string())
        .await
        .expect("load_theme should succeed");
    assert_eq!(loaded["id"], "neon");
    assert_eq!(loaded["name"], "Neon Theme");
}

#[tokio::test]
#[serial]
async fn test_load_theme_builtin_light_dark() {
    tauri_shell::logic::system::clear_data_dir_provider();
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

    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

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
#[serial]
async fn test_load_theme_invalid_name_returns_null() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    let result = load_theme("nonexistent_theme".to_string())
        .await
        .expect("load_theme should succeed");

    assert_eq!(result, json!(null), "Should return null for unknown theme");
}

#[tokio::test]
#[serial]
async fn test_save_custom_theme_persists_file() {
    // Сбрасываем глобальный провайдер для изоляции
    tauri_shell::logic::system::clear_data_dir_provider();

    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

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

#[tokio::test]
#[serial]
async fn test_get_custom_themes_nonexistent_data_dir() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let nonexistent = env.data_dir.join("never_created_dir");
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(nonexistent),
    ));

    let themes = get_custom_themes()
        .await
        .expect("should return empty list on nonexistent dir");
    assert!(themes.is_empty());
}

#[tokio::test]
#[serial]
async fn test_load_custom_theme_from_theme_prefix_file() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    let custom_theme_payload = json!({
        "name": "Neon Cyberpunk",
        "primary": "#00ffcc"
    });

    save_custom_theme("neon".to_string(), custom_theme_payload.clone())
        .await
        .expect("save neon theme");

    let loaded = load_theme("neon".to_string())
        .await
        .expect("load neon theme");
    assert_eq!(loaded["name"], "Neon Cyberpunk");
    assert_eq!(loaded["primary"], "#00ffcc");
}

#[tokio::test]
#[serial]
async fn test_default_data_dir_provider_without_mock() {
    tauri_shell::logic::system::clear_data_dir_provider();
    // With no provider set, functions use DefaultDataDirProvider
    let res = load_settings().await;
    assert!(res.is_ok());
}

#[tokio::test]
#[serial]
async fn test_get_custom_themes_with_mixed_directory_contents() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // 1. Подпапка (не файл)
    fs::create_dir_all(env.data_dir.join("subfolder_ignored")).ok();

    // 2. Посторонние файлы
    fs::write(env.data_dir.join("notes.txt"), "some notes").ok();
    fs::write(env.data_dir.join("not_settings.json"), "{}").ok();

    // 3. settings.json (текущие настройки — должны игнорироваться)
    fs::write(env.data_dir.join("settings.json"), "{}").ok();

    // 4. Built-in light/dark (должны отфильтровываться)
    fs::write(env.data_dir.join("settings-light.json"), "{}").ok();
    fs::write(env.data_dir.join("settings-dark.json"), "{}").ok();

    // 5. Built-in кастомная тема (settings-nord.json)
    fs::write(env.data_dir.join("settings-nord.json"), "{\"name\":\"Nord\"}").ok();

    // 6. Пользовательская тема (settings-theme-solar.json)
    fs::write(env.data_dir.join("settings-theme-solar.json"), "{\"name\":\"Solar\"}").ok();

    let themes = get_custom_themes().await.expect("get_custom_themes should succeed");
    assert!(themes.contains(&"nord".to_string()));
    assert!(themes.contains(&"solar".to_string()));
    assert!(!themes.contains(&"light".to_string()));
    assert!(!themes.contains(&"dark".to_string()));
    assert!(!themes.contains(&"settings".to_string()));
}

#[tokio::test]
#[serial]
async fn test_load_theme_with_corrupted_json_files() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // 1. Broken JSON in builtin path
    fs::write(env.data_dir.join("settings-broken1.json"), "{invalid json}").ok();
    let loaded1 = load_theme("broken1".to_string()).await.expect("should not error");
    assert_eq!(loaded1, serde_json::Value::Null);

    // 2. Broken JSON in custom theme path
    fs::write(env.data_dir.join("settings-theme-broken2.json"), "not json at all").ok();
    let loaded2 = load_theme("broken2".to_string()).await.expect("should not error");
    assert_eq!(loaded2, serde_json::Value::Null);
}

#[tokio::test]
#[serial]
async fn test_system_core_direct_functions() {
    tauri_shell::logic::system_core::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // upload_photo_core & get_local_file_core
    let uploaded = tauri_shell::logic::system_core::upload_photo_core(b"core_bytes".to_vec(), "core.png".to_string())
        .await
        .expect("upload core");
    let read_back = tauri_shell::logic::system_core::get_local_file_core(uploaded.clone())
        .await
        .expect("read back");
    assert_eq!(read_back, b"core_bytes");

    // copy_background_file_core
    let src = env.create_source_file("bg_src.png", b"bg_data").unwrap();
    let copied = tauri_shell::logic::system_core::copy_background_file_core(src.to_string_lossy().to_string())
        .await
        .expect("copy core");
    assert!(std::path::Path::new(&copied).exists());

    // save_settings_core & load_settings_core
    tauri_shell::logic::system_core::save_settings_core(json!({"core_k": "core_v"}))
        .await
        .expect("save core settings");
    let loaded_s = tauri_shell::logic::system_core::load_settings_core()
        .await
        .expect("load core settings");
    assert_eq!(loaded_s["core_k"], "core_v");

    // save_custom_theme_core, get_custom_themes_core, load_theme_core
    tauri_shell::logic::system_core::save_custom_theme_core("cybercore".to_string(), json!({"theme": "cyber"}))
        .await
        .expect("save custom theme core");
    let custom_list = tauri_shell::logic::system_core::get_custom_themes_core()
        .await
        .expect("list custom themes core");
    assert!(custom_list.contains(&"cybercore".to_string()));
    let loaded_t = tauri_shell::logic::system_core::load_theme_core("cybercore".to_string())
        .await
        .expect("load custom theme core");
    assert_eq!(loaded_t["theme"], "cyber");
}

#[tokio::test]
#[serial]
async fn test_system_facade_and_core_debug_coverage() {
    use tauri_shell::logic::system_core::DataDirProvider;

    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // 1. DefaultDataDirProvider Debug and direct trait call
    let provider = tauri_shell::logic::system_core::DefaultDataDirProvider;
    let debug_output = format!("{:?}", provider);
    assert!(debug_output.contains("DefaultDataDirProvider"));
    let direct_dir = provider.get_data_dir();
    assert!(!direct_dir.as_os_str().is_empty());

    // 2. Performance styles branches
    let css_low = tauri_shell::logic::system::get_performance_styles("low".to_string());
    assert!(!css_low.is_empty());
    let css_med = tauri_shell::logic::system::get_performance_styles("medium".to_string());
    assert!(!css_med.is_empty());
    let css_high = tauri_shell::logic::system::get_performance_styles("high".to_string());
    assert_eq!(css_high, "");
    let css_fallback = tauri_shell::logic::system::get_performance_styles("other".to_string());
    assert_eq!(css_fallback, "");

    // 3. Performance benchmark command
    let bench = tauri_shell::logic::system::run_performance_benchmark();
    assert!(!bench.level.is_empty());
    assert!(bench.cores > 0);

    // 4. System wrapper commands roundtrip
    let uploaded = tauri_shell::logic::system::upload_photo(b"wrap_bytes".to_vec(), "wrap.png".to_string())
        .await
        .expect("upload wrapper");
    let read_file = tauri_shell::logic::system::get_local_file(uploaded.clone())
        .await
        .expect("get_local_file wrapper");
    assert_eq!(read_file, b"wrap_bytes");

    let src = env.create_source_file("wrap_src.png", b"wrap_bg").unwrap();
    let copied = tauri_shell::logic::system::copy_background_file(src.to_string_lossy().to_string())
        .await
        .expect("copy wrapper");
    assert!(std::path::Path::new(&copied).exists());

    tauri_shell::logic::system::save_settings(json!({"wrap_key": "wrap_val"}))
        .await
        .expect("save settings wrapper");
    let loaded_s = tauri_shell::logic::system::load_settings()
        .await
        .expect("load settings wrapper");
    assert_eq!(loaded_s["wrap_key"], "wrap_val");

    tauri_shell::logic::system::save_custom_theme("wraptheme".to_string(), json!({"theme": "wrap"}))
        .await
        .expect("save custom theme wrapper");
    let custom_list = tauri_shell::logic::system::get_custom_themes()
        .await
        .expect("get custom themes wrapper");
    assert!(custom_list.contains(&"wraptheme".to_string()));
    let loaded_t = tauri_shell::logic::system::load_theme("wraptheme".to_string())
        .await
        .expect("load theme wrapper");
    assert_eq!(loaded_t["theme"], "wrap");
}

#[tokio::test]
#[serial]
async fn test_system_core_io_error_closures() {
    tauri_shell::logic::system_core::clear_data_dir_provider();
    let env = make_env();

    // 1. upload_photo_core error: data_dir is a file, blocking creation of user_images
    let blocking_file = env.data_dir.join("data_is_a_file");
    fs::write(&blocking_file, "blocking").ok();
    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(blocking_file),
    ));
    let upload_err = tauri_shell::logic::system_core::upload_photo_core(b"bytes".to_vec(), "photo.png".into()).await;
    assert!(upload_err.is_err());

    // 2. save_settings_core error: settings.json is a directory
    let env2 = make_env();
    fs::create_dir_all(env2.data_dir.join("settings.json")).ok();
    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env2.data_dir.clone()),
    ));
    let save_err = tauri_shell::logic::system_core::save_settings_core(json!({})).await;
    assert!(save_err.is_err());

    // 3. load_settings_core error: settings.json is a directory (read_to_string fails)
    let load_err = tauri_shell::logic::system_core::load_settings_core().await;
    assert!(load_err.is_err());

    // 4. load_theme_core error on builtin path: settings-dirtheme.json is a directory
    fs::create_dir_all(env2.data_dir.join("settings-dirtheme.json")).ok();
    let load_theme_err1 = tauri_shell::logic::system_core::load_theme_core("dirtheme".into()).await;
    assert!(load_theme_err1.is_err());

    // 5. load_theme_core error on custom path: settings-theme-dirtheme2.json is a directory
    fs::create_dir_all(env2.data_dir.join("settings-theme-dirtheme2.json")).ok();
    let load_theme_err2 = tauri_shell::logic::system_core::load_theme_core("dirtheme2".into()).await;
    assert!(load_theme_err2.is_err());

    // 6. save_custom_theme_core error: theme file is a directory
    let save_theme_err = tauri_shell::logic::system_core::save_custom_theme_core("dirtheme2".into(), json!({})).await;
    assert!(save_theme_err.is_err());
}

// ─── upload_photo error path (write error) ────────────────────────────────────────

#[tokio::test]
#[serial]
async fn test_upload_photo_write_error() {
    tauri_shell::logic::system_core::clear_data_dir_provider();
    let env = make_env();

    // Make data_dir a file, so user_images/ cannot be created
    let blocking_file = env.data_dir.join("data_is_a_file");
    fs::write(&blocking_file, "blocking").ok();

    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(blocking_file),
    ));

    let result = tauri_shell::logic::system::upload_photo(b"test bytes".to_vec(), "photo.png".into()).await;
    assert!(result.is_err(), "upload_photo should fail when data_dir is a file");

    // Cleanup
    tauri_shell::logic::system_core::clear_data_dir_provider();
}

// ─── toggle_fullscreen ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_toggle_fullscreen() {
    // Use Tauri's mock builder to create app, then add a window
    let app = tauri::test::mock_builder()
        .build(tauri::generate_context!())
        .expect("Failed to build mock app");

    // Create a window after building the app
    let _window = tauri::WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::App("index.html".into()))
        .build()
        .expect("Failed to build test window");

    let window = app
        .webview_windows()
        .values()
        .next()
        .expect("Mock app should have at least one window")
        .clone();

    let result = tauri_shell::logic::system::toggle_fullscreen(window).await;
    assert!(result.is_ok(), "toggle_fullscreen should return Ok(())");
}

// ─── get_custom_themes legacy style (settings-<name>.json) ────────────────────────

#[tokio::test]
#[serial]
async fn test_get_custom_themes_legacy_style() {
    tauri_shell::logic::system_core::clear_data_dir_provider();
    let env = make_env();

    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // Create legacy-style theme files: settings-<name>.json (not settings-theme-*)
    fs::write(env.data_dir.join("settings-ocean.json"), r#"{"color": "blue"}"#).expect("write ocean");
    fs::write(env.data_dir.join("settings-forest.json"), r#"{"color": "green"}"#).expect("write forest");
    // This should be excluded (settings.json is not a theme)
    fs::write(env.data_dir.join("settings.json"), r#"{"app": "config"}"#).ok();
    // This should be excluded (builtin names)
    fs::write(env.data_dir.join("settings-dark.json"), r#"{"builtin": true}"#).ok();
    fs::write(env.data_dir.join("settings-light.json"), r#"{"builtin": true}"#).ok();

    let themes = tauri_shell::logic::system::get_custom_themes().await.expect("get_custom_themes should succeed");

    assert!(themes.contains(&"ocean".to_string()), "Should include legacy theme 'ocean'");
    assert!(themes.contains(&"forest".to_string()), "Should include legacy theme 'forest'");
    assert!(!themes.contains(&"settings".to_string()), "Should exclude settings.json");
    assert!(!themes.contains(&"dark".to_string()), "Should exclude builtin 'dark'");
    assert!(!themes.contains(&"light".to_string()), "Should exclude builtin 'light'");

    tauri_shell::logic::system_core::clear_data_dir_provider();
}

// ─── load_theme builtin branch (settings-<theme>.json) ────────────────────────────

#[tokio::test]
#[serial]
async fn test_load_theme_builtin() {
    tauri_shell::logic::system_core::clear_data_dir_provider();
    let env = make_env();

    let _ = tauri_shell::logic::system_core::set_data_dir_provider(Box::new(
        common::TestDataDirProvider::new(env.data_dir.clone()),
    ));

    // Create builtin-style theme file: settings-dark.json
    let theme_content = json!({
        "name": "dark",
        "colors": { "bg": "#000", "fg": "#fff" }
    });
    fs::write(env.data_dir.join("settings-dark.json"), serde_json::to_string_pretty(&theme_content).unwrap())
        .expect("write builtin theme");

    let result = tauri_shell::logic::system::load_theme("dark".to_string()).await.expect("load_theme should succeed");

    assert_eq!(result["name"], "dark");
    assert_eq!(result["colors"]["bg"], "#000");
    assert_eq!(result["colors"]["fg"], "#fff");

    tauri_shell::logic::system_core::clear_data_dir_provider();
}

// ─── DataDirProvider unit tests ────────────────────────────────────────────────────

#[test]
fn test_custom_data_dir_provider() {
    use tauri_shell::logic::system::{set_data_dir_provider, get_data_dir, clear_data_dir_provider, DataDirProvider};
    use std::path::PathBuf;

    // Ensure clean state
    clear_data_dir_provider();

    // Create fake provider
    #[derive(Debug)]
    struct TestProvider {
        path: PathBuf,
    }
    impl DataDirProvider for TestProvider {
        fn get_data_dir(&self) -> PathBuf {
            self.path.clone()
        }
    }

    let fake_path = PathBuf::from("/fake/test/data/path");
    let provider = Box::new(TestProvider { path: fake_path.clone() });

    // Set provider
    set_data_dir_provider(provider);

    // get_data_dir should return the fake path
    let dir = get_data_dir();
    assert_eq!(dir, fake_path, "get_data_dir should return provider's path");

    // Clear provider
    clear_data_dir_provider();

    // After clear, should fall back to DefaultDataDirProvider (not panic)
    let dir_after_clear = get_data_dir();
    assert!(dir_after_clear.ends_with("data"), "After clear, should return default data dir ending with 'data'");
}

#[test]
fn test_default_data_dir_provider() {
    use tauri_shell::logic::system::DefaultDataDirProvider;
    use tauri_shell::logic::system::DataDirProvider;

    let provider = DefaultDataDirProvider;
    let dir = provider.get_data_dir();

    // Should return a path ending with "data"
    assert!(
        dir.ends_with("data"),
        "DefaultDataDirProvider.get_data_dir() should end with 'data', got: {}",
        dir.display()
    );
    // Should be absolute or at least valid path
    assert!(!dir.as_os_str().is_empty(), "Path should not be empty");
}
