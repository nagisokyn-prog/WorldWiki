//! Интеграционные тесты экспорта и бэкапов (`logic/export.rs`).
//!
//! Тестируют:
//! - `export_chapters_inner`: объединение глав в итоговый файл.
//! - `create_cloud_backup_inner`: экспорт дампа БД и упаковку в `.wwiki` (zip).
//! - `restore_from_backup_inner`: восстановление БД из `.wwiki` (roundtrip).
//! - Негативные сценарии: отсутствующий файл, zip без `database.surql`.
//! - `get_launch_args`.

use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use serde_json::json;

use worldwiki_infrastructure::storage::backup::*;
use worldwiki_tauri::commands::get_launch_args;
use super::common::{create_test_db, seed_project};

static __TMP_IDX: AtomicUsize = AtomicUsize::new(0);

/// Создаёт уникальный временный каталог для изоляции файловых тестов
/// между параллельными запусками (аналогично `common::create_test_db`).
fn tmp_dir(tag: &str) -> PathBuf {
    let idx = __TMP_IDX.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "worldwiki-export-test-{}-{}-{}-{}",
        std::process::id(),
        idx,
        tag,
        uuid::Uuid::new_v4()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[tokio::test]
async fn export_chapters_writes_combined_file() {
    let dir = tmp_dir("chapters");

    let chapters = vec![
        json!({ "title": "Пролог", "content": "В начале было слово." }),
        json!({ "title": "Глава 1", "content": "Дальше — больше." }),
    ];

    let path = export_chapters_inner(&dir, &chapters, "md").expect("export should succeed");
    let expected = dir.join("exported_chapters.md");
    assert_eq!(Path::new(&path), expected.as_path());

    let content = std::fs::read_to_string(&expected).expect("exported file should exist");
    assert!(content.contains("=== Пролог ==="), "должен быть заголовок Пролога");
    assert!(content.contains("В начале было слово."), "должен сохраниться контент Пролога");
    assert!(content.contains("=== Глава 1 ==="));
    assert!(content.contains("Дальше — больше."));
}

#[tokio::test]
async fn export_chapters_handles_missing_title_and_content() {
    let dir = tmp_dir("chapters_fallback");

    let chapters = vec![
        json!({}), // нет ни title, ни content
        json!({ "title": "Без контента" }),
    ];

    export_chapters_inner(&dir, &chapters, "txt").expect("export should succeed");

    let content = std::fs::read_to_string(dir.join("exported_chapters.txt")).expect("file");
    assert!(content.contains("=== Без названия ==="), "пустой title заменяется дефолтом");
    assert!(content.contains("=== Без контента ==="));
}

#[tokio::test]
async fn create_cloud_backup_creates_wwiki_with_database_dump() {
    let db = create_test_db().await;
    seed_project(&db, "backup_proj", "Backup Project").await;

    let dir = tmp_dir("backup");

    let zip_path = create_cloud_backup_inner(&db, &dir)
        .await
        .expect("backup should succeed");

    assert!(Path::new(&zip_path).exists(), "zip-файл должен существовать");
    assert!(zip_path.ends_with(".wwiki"));

    // Читаем zip и проверяем, что внутри есть database.surql с засеянным проектом
    let file = std::fs::File::open(&zip_path).expect("open zip");
    let mut archive = zip::ZipArchive::new(file).expect("read zip");

    let mut dump = archive
        .by_name("database.surql")
        .expect("database.surql должен быть внутри архива");
    let mut surql = String::new();
    std::io::Read::read_to_string(&mut dump, &mut surql).expect("read surql dump");

    assert!(surql.contains("backup_proj"), "дамп должен содержать засеянный проект");
}

#[tokio::test]
async fn restore_from_backup_roundtrip_restores_project() {
    // БД-источник: сидим проект и делаем бэкап
    let src = create_test_db().await;
    seed_project(&src, "roundtrip_proj", "Roundtrip Project").await;

    let dir = tmp_dir("roundtrip");
    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup");

    // БД-приёмник: свежая, восстанавливаем из бэкапа
    let dst = create_test_db().await;
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("restore should succeed");

    // Проверяем, что проект появился в приёмнике
    let mut res = dst
        .query("SELECT name FROM projects WHERE id = type::record('projects:roundtrip_proj')")
        .await
        .expect("query projects");
    let rows: Vec<serde_json::Value> = res.take(0).expect("take rows");
    assert_eq!(rows.len(), 1, "проект должен восстановиться из бэкапа");
    assert_eq!(rows[0]["name"], "Roundtrip Project");
}

#[tokio::test]
async fn restore_from_backup_missing_file_returns_err() {
    let db = create_test_db().await;
    let missing = tmp_dir("missing").join("nope.wwiki");

    let res = restore_from_backup_inner(&db, missing.to_str().unwrap()).await;
    assert!(res.is_err(), "несуществующий файл должен вернуть Err");
    assert!(res.unwrap_err().to_string().contains("does not exist"));
}

#[tokio::test]
async fn restore_from_backup_zip_without_database_surql_returns_err() {
    let db = create_test_db().await;
    let dir = tmp_dir("bad_zip");

    // Собираем валидный zip, но без database.surql
    let zip_path = dir.join("bad.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);
    zw.start_file("random.txt", zip::write::SimpleFileOptions::default())
        .expect("start file");
    zw.write_all(b"hello").expect("write");
    zw.finish().expect("finish zip");

    let res = restore_from_backup_inner(&db, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "zip без database.surql должен вернуть Err");
    assert!(res.unwrap_err().to_string().contains("database.surql not found"));
}

#[test]
fn get_launch_args_returns_none_without_wwiki_arg() {
    // При обычном запуске тестов первый аргумент — путь к бинарнику,
    // а не аргумент вида `*.wwiki`, поэтому возвращается None.
    assert!(get_launch_args().is_none());
}

