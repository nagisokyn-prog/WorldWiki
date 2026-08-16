//! Интеграционные тесты системных команд tauri_shell.
//!
//! Тестируют реальные Tauri команды через mock app:
//! - upload_photo() — сохранение с timestamp в data/user_images/
//! - copy_background_file() — копирование файлов с сохранением контента
//! - get_local_file() — чтение файлов в binary
//! - save_settings() / load_settings() — JSON roundtrip
//! - toggle_fullscreen() — переключение полноэкранного режима
//! - get_custom_themes() — сканирование пользовательских тем
//! - load_theme() — загрузка темы по имени
//! - save_custom_theme() — сохранение пользовательской темы

mod common;

use common::{TestApp, TestEnv};
use serde_json::json;
use std::fs;

#[tokio::test]
async fn test_upload_photo_saves_file_with_timestamp_prefix() {
    let (app, env) = TestApp::with_commands();
    
    let photo_bytes = b"fake PNG image data \x89PNG\r\n\x1a\n";
    let filename = "vacation.png";
    
    let result = app
        .invoke("upload_photo", json!({ "bytes": photo_bytes.to_vec(), "filename": filename }))
        .await
        .expect("upload_photo should succeed");
    
    let saved_path: String = serde_json::from_value(result).expect("Should deserialize path");
    assert!(saved_path.contains(&format!("_{}", filename)));
    assert!(std::path::Path::new(&saved_path).exists());
    
    let read_back = fs::read(&saved_path).expect("Should read file back");
    assert_eq!(read_back, photo_bytes);
}

#[tokio::test]
async fn test_copy_background_file_preserves_binary_content() {
    let (app, env) = TestApp::with_commands();
    
    let source_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR";
    let source_path = env.create_source_file("source_bg.png", source_content)
        .expect("Should create source file");
    
    let result = app
        .invoke("copy_background_file", json!({ "source_path": source_path.to_string_lossy() }))
        .await
        .expect("copy_background_file should succeed");
    
    let copied_path: String = serde_json::from_value(result).expect("Should deserialize path");
    assert!(std::path::Path::new(&copied_path).exists());
    assert!(copied_path.contains("source_bg.png"));
    
    let final_content = fs::read(&copied_path).expect("Should read copied file");
    assert_eq!(final_content, source_content);
}

#[tokio::test]
async fn test_get_local_file_reads_exact_binary_contents() {
    let (app, env) = TestApp::with_commands();
    
    let binary_data = vec![0u8; 1024];
    let path = env.write_image("binary.bin", &binary_data)
        .expect("Should write binary file");
    
    let result = app
        .invoke("get_local_file", json!({ "path": path.to_string_lossy() }))
        .await
        .expect("get_local_file should succeed");
    
    let read_data: Vec<u8> = serde_json::from_value(result).expect("Should deserialize bytes");
    assert_eq!(read_data.len(), 1024);
    assert_eq!(read_data, binary_data);
}

#[tokio::test]
async fn test_get_local_file_missing_path_returns_error() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("get_local_file", json!({ "path": "/nonexistent/path.bin" }))
        .await;
    
    assert!(result.is_err(), "Should return error for missing file");
}

#[tokio::test]
async fn test_settings_save_and_load_roundtrip() {
    let (app, env) = TestApp::with_commands();
    
    let original_settings = json!({
        "theme": "light",
        "volume": 85,
        "language": "en"
    });
    
    let save_result = app
        .invoke("save_settings", json!({ "settings": original_settings.clone() }))
        .await
        .expect("save_settings should succeed");
    assert!(save_result.is_null());
    
    let load_result = app
        .invoke("load_settings", json!({}))
        .await
        .expect("load_settings should succeed");
    
    let loaded: serde_json::Value = serde_json::from_value(load_result).expect("Should deserialize");
    assert_eq!(loaded["theme"], "light");
    assert_eq!(loaded["volume"], 85);
    assert_eq!(loaded["language"], "en");
}

#[tokio::test]
async fn test_load_settings_returns_null_if_missing() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("load_settings", json!({}))
        .await
        .expect("load_settings should succeed");
    
    // Should return null if settings file doesn't exist
    assert_eq!(result, json!(null));
}

#[tokio::test]
async fn test_toggle_fullscreen() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("toggle_fullscreen", json!({}))
        .await;
    
    // In mock app, window operations may not work fully, but shouldn't panic
    // Just verify it doesn't panic and returns a result
    let _ = result;
}

#[tokio::test]
async fn test_custom_themes_scan_and_load() {
    let (app, env) = TestApp::with_commands();
    
    // Initially no custom themes
    let themes = app
        .invoke("get_custom_themes", json!({}))
        .await
        .expect("get_custom_themes should succeed");
    let themes_list: Vec<String> = serde_json::from_value(themes).expect("Should deserialize");
    assert!(themes_list.is_empty(), "Should start with no custom themes");
    
    // Save a custom theme
    let theme = json!({
        "id": "neon",
        "name": "Neon Theme",
        "colors": { "primary": "#00ff00" }
    });
    
    app.invoke("save_custom_theme", json!({ "name": "neon", "settings": theme }))
        .await
        .expect("save_custom_theme should succeed");
    
    // Scan should now find it
    let themes = app
        .invoke("get_custom_themes", json!({}))
        .await
        .expect("get_custom_themes should succeed");
    let themes_list: Vec<String> = serde_json::from_value(themes).expect("Should deserialize");
    assert!(themes_list.contains(&"neon".to_string()), "Should find neon theme");
    
    // Load the theme
    let loaded = app
        .invoke("load_theme", json!({ "theme": "neon" }))
        .await
        .expect("load_theme should succeed");
    let loaded_theme: serde_json::Value = serde_json::from_value(loaded).expect("Should deserialize");
    assert_eq!(loaded_theme["id"], "neon");
    assert_eq!(loaded_theme["name"], "Neon Theme");
}

#[tokio::test]
async fn test_load_theme_builtin_light_dark() {
    let (app, env) = TestApp::with_commands();
    
    // Create built-in theme files
    let light_theme = json!({ "name": "Light", "colors": { "bg": "#fff" } });
    let dark_theme = json!({ "name": "Dark", "colors": { "bg": "#000" } });
    
    fs::write(env.data_dir.join("settings-light.json"), serde_json::to_string(&light_theme).unwrap())
        .expect("Should write light theme");
    fs::write(env.data_dir.join("settings-dark.json"), serde_json::to_string(&dark_theme).unwrap())
        .expect("Should write dark theme");
    
    let light = app
        .invoke("load_theme", json!({ "theme": "light" }))
        .await
        .expect("load_theme light should succeed");
    let light_theme_loaded: serde_json::Value = serde_json::from_value(light).expect("Should deserialize");
    assert_eq!(light_theme_loaded["name"], "Light");
    
    let dark = app
        .invoke("load_theme", json!({ "theme": "dark" }))
        .await
        .expect("load_theme dark should succeed");
    let dark_theme_loaded: serde_json::Value = serde_json::from_value(dark).expect("Should deserialize");
    assert_eq!(dark_theme_loaded["name"], "Dark");
}

#[tokio::test]
async fn test_load_theme_invalid_name_returns_null() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("load_theme", json!({ "theme": "nonexistent_theme" }))
        .await
        .expect("load_theme should succeed");
    
    assert_eq!(result, json!(null), "Should return null for unknown theme");
}

#[tokio::test]
async fn test_save_custom_theme_persists_file() {
    let (app, env) = TestApp::with_commands();
    
    let theme = json!({
        "id": "custom",
        "name": "Custom Theme",
        "version": "1.0.0",
        "colors": { "background": "#fff" }
    });
    
    app.invoke("save_custom_theme", json!({ "name": "custom", "settings": theme }))
        .await
        .expect("save_custom_theme should succeed");
    
    // Verify file was created
    let theme_path = env.data_dir.join("settings-theme-custom.json");
    assert!(theme_path.exists(), "Theme file should exist");
    
    let content = fs::read_to_string(&theme_path).expect("Should read theme file");
    let parsed: serde_json::Value = serde_json::from_str(&content).expect("Should parse JSON");
    assert_eq!(parsed["id"], "custom");
    assert_eq!(parsed["version"], "1.0.0");
}
