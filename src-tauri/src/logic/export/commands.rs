//! IPC layer for module `export`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use std::fs;
use std::path::PathBuf;
use serde_json::Value;

#[tauri::command]
pub async fn export_chapters(
    project: String,
    chapters: Vec<Value>,
    format: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Безопасное получение папки "Загрузки" в Tauri 2.0
    let target_dir = match app.path().download_dir() {
        Ok(dir) => dir.join(format!("{}_export", project)),
        Err(_) => PathBuf::from(".").join(format!("{}_export", project)),
    };

    export_chapters_inner(&target_dir, &chapters, &format)
}

#[tauri::command]
pub async fn create_cloud_backup(
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let db = &state.db;
    let target_dir = app
        .path()
        .app_data_dir()
        .unwrap_or(PathBuf::from("."))
        .join("backups");

    create_cloud_backup_inner(db, &target_dir).await
}

#[tauri::command]
pub async fn exchange_yandex_token(code: String) -> Result<String, String> {
    super::exchange_yandex_token_inner(&code, None).await
}

#[tauri::command]
pub async fn upload_to_yandex_disk(token: String, file_path: String) -> Result<(), String> {
    super::upload_to_yandex_disk_inner(&token, &file_path, None).await
}

#[tauri::command]
pub async fn list_yandex_disk_backups(token: String) -> Result<Vec<YandexBackupFile>, String> {
    super::list_yandex_disk_backups_inner(&token, None).await
}

#[tauri::command]
pub async fn download_and_restore_yandex(
    token: String,
    file_name: String,
    _app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    // Скачивание во временную папку — тестируемое ядро.
    let temp_file_path = super::download_yandex_file_inner(&token, &file_name, None).await?;

    // Восстановление из скачанного архива
    restore_from_backup(temp_file_path.to_string_lossy().to_string(), state).await?;

    // Cleanup
    if let Some(dir) = temp_file_path.parent() {
        let _ = fs::remove_dir_all(dir);
    }

    Ok(())
}

#[tauri::command]
pub async fn restore_from_backup(
    backup_path: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    restore_from_backup_inner(db, &backup_path).await
}

#[tauri::command]
pub fn get_launch_args() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1].ends_with(".wwiki") {
        Some(args[1].clone())
    } else {
        None
    }

}
