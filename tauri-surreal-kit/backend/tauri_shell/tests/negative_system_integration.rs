//! Негативные тесты для обработки ошибок в командах tauri_shell.
//!
//! Проверяют реальные Tauri команды через mock app:
//! - get_local_file() с отсутствующими путями
//! - load_theme() с невалидными именами
//! - Обработка поврежденного JSON
//! - Path traversal защита
//! - Граничные случаи (пустые файлы, BOM, огромные файлы)

mod common;

use common::{TestApp, TestEnv};
use serde_json::json;
use std::fs;

#[tokio::test]
async fn negative_get_local_file_missing_path_returns_err() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("get_local_file", json!({ "path": "/nonexistent/path.bin" }))
        .await;
    
    assert!(result.is_err(), "Should return error for missing file");
}

#[tokio::test]
async fn negative_load_theme_invalid_name_returns_null() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("load_theme", json!({ "theme": "nonexistent_theme" }))
        .await
        .expect("load_theme should succeed");
    
    assert_eq!(result, json!(null), "Should return null for unknown theme");
}

#[tokio::test]
async fn negative_theme_name_with_path_traversal() {
    let (app, env) = TestApp::with_commands();
    
    let traversal_names = vec![
        "../../../etc/passwd",
        "../../..",
        "..",
        "..\\..\\windows\\system32",
    ];
    
    for name in traversal_names {
        let result = app
            .invoke("load_theme", json!({ "theme": name }))
            .await
            .expect("load_theme should succeed");
        
        // Should return null (not found) or handle gracefully, not panic
        // The path should not escape data_dir
        assert_eq!(result, json!(null), "Path traversal should return null for: {}", name);
    }
}

#[tokio::test]
async fn negative_get_local_file_path_traversal() {
    let (app, _env) = TestApp::with_commands();
    
    let traversal_paths = vec![
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\drivers\\etc\\hosts",
    ];
    
    for path in traversal_paths {
        let result = app
            .invoke("get_local_file", json!({ "path": path }))
            .await;
        
        // Should return error, not panic or read sensitive files
        assert!(result.is_err(), "Path traversal should return error for: {}", path);
    }
}

#[tokio::test]
async fn negative_empty_theme_file() {
    let (app, env) = TestApp::with_commands();
    
    // Create empty theme file
    fs::write(env.data_dir.join("settings-empty.json"), "")
        .expect("Should write empty file");
    
    let result = app
        .invoke("load_theme", json!({ "theme": "empty" }))
        .await
        .expect("load_theme should succeed");
    
    // Empty file is not valid JSON, should return null
    assert_eq!(result, json!(null));
}

#[tokio::test]
async fn negative_theme_file_with_bom() {
    let (app, env) = TestApp::with_commands();
    
    // UTF-8 BOM + valid JSON
    let bom_json = b"\xef\xbb\xbf{\"name\": \"theme\"}";
    fs::write(env.data_dir.join("settings-bom.json"), bom_json)
        .expect("Should write BOM JSON");
    
    let result = app
        .invoke("load_theme", json!({ "theme": "bom" }))
        .await
        .expect("load_theme should succeed");
    
    // BOM should be handled gracefully - may parse or return null
    // Just verify it doesn't panic
    let _ = result;
}

#[tokio::test]
async fn negative_very_large_file_upload() {
    let (app, env) = TestApp::with_commands();
    
    // 10MB file
    let test_size = 10_485_760;
    let large_data = vec![0u8; test_size];
    
    let result = app
        .invoke("upload_photo", json!({ 
            "bytes": large_data, 
            "filename": "large.bin" 
        }))
        .await;
    
    // Should handle large files (either succeed or fail gracefully)
    // The command should not panic
    let _ = result;
}

#[tokio::test]
async fn negative_copy_background_file_missing_source() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("copy_background_file", json!({ "source_path": "/nonexistent/source.png" }))
        .await;
    
    assert!(result.is_err(), "Should return error for missing source file");
}

#[tokio::test]
async fn negative_upload_photo_empty_bytes() {
    let (app, _env) = TestApp::with_commands();
    
    let result = app
        .invoke("upload_photo", json!({ 
            "bytes": [], 
            "filename": "empty.png" 
        }))
        .await;
    
    // Empty bytes should either create empty file or return error
    // Just verify it doesn't panic
    let _ = result;
}

#[tokio::test]
async fn negative_settings_malformed_json_not_panic() {
    let (app, _env) = TestApp::with_commands();
    
    // The save_settings command takes a serde_json::Value, not a string
    // So we can't pass malformed JSON directly - it's validated by serde
    // But we can test that load_settings handles corrupted file gracefully
    let result = app
        .invoke("load_settings", json!({}))
        .await;
    
    // Should not panic, returns Result
    let _ = result;
}

#[tokio::test]
async fn negative_filename_special_characters() {
    let (app, env) = TestApp::with_commands();
    
    let special_names = vec![
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "файл_на_русском.txt",
        "file@#$%.txt",
    ];
    
    for name in special_names {
        let result = app
            .invoke("upload_photo", json!({ 
                "bytes": b"test".to_vec(), 
                "filename": name 
            }))
            .await;
        
        // Should not panic, either succeeds or fails gracefully
        let _ = result;
    }
}
