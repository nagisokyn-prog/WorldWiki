use std::fs;
use std::path::PathBuf;
use serde_json::Value;
use tauri::Manager;
use worldwiki_domain::storage::YandexBackupFile;
use worldwiki_infrastructure::storage::{
    export_chapters_inner, create_cloud_backup_inner, restore_from_backup_inner,
    exchange_yandex_token_inner, upload_to_yandex_disk_inner, list_yandex_disk_backups_inner,
    download_yandex_file_inner,
};
use crate::state::AppState;

#[tauri::command]
pub async fn export_chapters(
    project: String,
    chapters: Vec<Value>,
    format: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let target_dir = match app.path().download_dir() {
        Ok(dir) => dir.join(format!("{}_export", project)),
        Err(_) => PathBuf::from(".").join(format!("{}_export", project)),
    };

    export_chapters_inner(&target_dir, &chapters, &format)
}

#[tauri::command]
pub async fn create_cloud_backup(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let db = &state.services.db;
    let target_dir = app
        .path()
        .app_data_dir()
        .unwrap_or(PathBuf::from("."))
        .join("backups");

    create_cloud_backup_inner(db, &target_dir).await
}

#[tauri::command]
pub async fn exchange_yandex_token(code: String) -> Result<String, String> {
    exchange_yandex_token_inner(&code, None).await
}

#[tauri::command]
pub async fn upload_to_yandex_disk(token: String, file_path: String) -> Result<(), String> {
    upload_to_yandex_disk_inner(&token, &file_path, None).await
}

#[tauri::command]
pub async fn list_yandex_disk_backups(token: String) -> Result<Vec<YandexBackupFile>, String> {
    list_yandex_disk_backups_inner(&token, None).await
}

#[tauri::command]
pub async fn download_and_restore_yandex(
    token: String,
    file_name: String,
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let temp_file_path = download_yandex_file_inner(&token, &file_name, None).await?;

    let db = &state.services.db;
    restore_from_backup_inner(db, &temp_file_path.to_string_lossy()).await?;

    if let Some(dir) = temp_file_path.parent() {
        let _ = fs::remove_dir_all(dir);
    }

    Ok(())
}

#[tauri::command]
pub async fn restore_from_backup(
    backup_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.services.db;
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
