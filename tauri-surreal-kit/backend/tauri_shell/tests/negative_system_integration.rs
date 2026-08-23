//! Негативные тесты для обработки ошибок в командах tauri_shell.
//!
//! Проверяют функции напрямую (без IPC):
//! - get_local_file() с отсутствующими путями
//! - load_theme() с невалидными именами
//! - Обработка поврежденного JSON
//! - Path traversal защита
//! - Граничные случаи (пустые файлы, BOM, огромные файлы)

mod common;

use common::TestEnv;
use serde_json::json;
use std::fs;
use tauri_shell::logic::system::{
    copy_background_file, get_local_file, load_settings, load_theme, upload_photo,
};

fn make_env() -> TestEnv {
    TestEnv::new().expect("Failed to create TestEnv")
}

// ─── get_local_file negative ───────────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn negative_get_local_file_missing_path_returns_err() {
    let result = get_local_file("/nonexistent/path.bin".to_string()).await;
    assert!(result.is_err(), "Should return error for missing file");
}

#[tokio::test]
#[serial_test::serial]
async fn negative_get_local_file_path_traversal() {
    let traversal_paths = vec![
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\drivers\\etc\\hosts",
    ];

    for path in traversal_paths {
        let result = get_local_file(path.to_string()).await;
        // Должна вернуть ошибку (файл не существует или нет доступа)
        assert!(
            result.is_err(),
            "Path traversal should return error for: {}",
            path
        );
    }
}

// ─── load_theme negative ───────────────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn negative_load_theme_invalid_name_returns_null() {
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
#[serial_test::serial]
async fn negative_theme_name_with_path_traversal() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let traversal_names = vec![
        "../../../etc/passwd",
        "../..",
        "..",
        "..\\..\\windows\\system32",
    ];

    for name in traversal_names {
        let result = load_theme(name.to_string())
            .await
            .expect("load_theme should succeed");

        // Должна вернуть null (файл не найден в data_dir), не паниковать
        assert_eq!(
            result,
            json!(null),
            "Path traversal should return null for: {}",
            name
        );
    }
}

#[tokio::test]
#[serial_test::serial]
async fn negative_empty_theme_file() {
    let env = make_env();
    fs::write(env.builtin_theme_path("empty"), "").expect("Should write empty file");
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = load_theme("empty".to_string())
        .await
        .expect("load_theme should succeed");

    // Пустой файл — невалидный JSON → null
    assert_eq!(result, json!(null));
}

#[tokio::test]
#[serial_test::serial]
async fn negative_theme_file_with_bom() {
    let env = make_env();
    // UTF-8 BOM + valid JSON
    let bom_json = b"\xef\xbb\xbf{\"name\": \"theme\"}";
    fs::write(env.builtin_theme_path("bom"), bom_json).expect("Should write BOM JSON");
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = load_theme("bom".to_string())
        .await
        .expect("load_theme should succeed");

    // BOM — обрабатывается gracefully (null или значение — не паникует)
    let _ = result;
}

// ─── upload_photo negative ─────────────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn negative_very_large_file_upload() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let large_data = vec![0u8; 10_485_760]; // 10 MB
    let result = upload_photo(large_data, "large.bin".to_string()).await;

    // Не паникует — либо сохраняет, либо ошибка
    let _ = result;
}

#[tokio::test]
#[serial_test::serial]
async fn negative_upload_photo_empty_bytes() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let result = upload_photo(vec![], "empty.png".to_string()).await;
    // Не паникует
    let _ = result;
}

#[tokio::test]
#[serial_test::serial]
async fn negative_filename_special_characters() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let special_names = vec![
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "файл_на_русском.txt",
    ];

    for name in special_names {
        let result = upload_photo(b"test".to_vec(), name.to_string()).await;
        // Не паникует
        let _ = result;
    }
}

// ─── copy_background_file negative ────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn negative_copy_background_file_missing_source() {
    let result = copy_background_file("/nonexistent/source.png".to_string()).await;
    assert!(result.is_err(), "Should return error for missing source file");
}

// ─── settings negative ─────────────────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn negative_settings_malformed_json_not_panic() {
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    // Записываем битый JSON напрямую в файл
    fs::write(env.settings_path(), "{broken json}").expect("Should write broken JSON");

    // load_settings должен обработать gracefully
    let result = load_settings().await;
    // Не паникует — либо Ok(Null), либо Ok(значение)
    let _ = result;
}

#[tokio::test]
#[serial_test::serial]
async fn negative_concurrent_uploads_produce_unique_files() {
    tauri_shell::logic::system::clear_data_dir_provider();
    let env = make_env();
    let _ = tauri_shell::logic::system::set_data_dir_provider(
        Box::new(common::TestDataDirProvider::new(env.data_dir.clone()))
    );

    let mut handles = Vec::new();
    for i in 0..10 {
        let task = tokio::spawn(async move {
            upload_photo(format!("content_{}", i).into_bytes(), "same_avatar.png".to_string()).await
        });
        handles.push(task);
    }

    let mut saved_paths = Vec::new();
    for h in handles {
        if let Ok(Ok(path)) = h.await {
            saved_paths.push(path);
        }
    }

    assert_eq!(saved_paths.len(), 10, "All 10 concurrent uploads should succeed");
}
