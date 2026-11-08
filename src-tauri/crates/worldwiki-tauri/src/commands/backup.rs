use std::fs;
use std::path::PathBuf;
use serde_json::Value;
use tauri::{Emitter, Manager};
use worldwiki_domain::storage::YandexBackupFile;
use worldwiki_infrastructure::storage::{
    create_cloud_backup_inner, download_missing_media_inner, download_yandex_file_inner,
    exchange_yandex_token_inner, export_chapters_inner, list_yandex_disk_backups_inner,
    restore_from_backup_inner, sync_media_to_yandex_inner, upload_to_yandex_disk_inner,
    MediaSyncProgress,
};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn export_chapters(
    project: String,
    chapters: Vec<Value>,
    format: String,
    app: tauri::AppHandle,
) -> Result<String, IpcError> {
    let target_dir = match app.path().download_dir() {
        Ok(dir) => dir.join(format!("{}_export", project)),
        Err(_) => PathBuf::from(".").join(format!("{}_export", project)),
    };

    export_chapters_inner(&target_dir, &chapters, &format).map_err(IpcError::from)
}

#[tauri::command]
pub async fn create_cloud_backup(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, IpcError> {
    let db = &state.services.db;
    let target_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("backups");

    create_cloud_backup_inner(db, &target_dir)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn exchange_yandex_token(code: String) -> Result<String, IpcError> {
    exchange_yandex_token_inner(&code, None)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn upload_to_yandex_disk(token: String, file_path: String) -> Result<(), IpcError> {
    upload_to_yandex_disk_inner(&token, &file_path, None)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn sync_yandex_media(
    token: String,
    app: tauri::AppHandle,
) -> Result<usize, IpcError> {
    let base_data_dir = if let Ok(custom_dir) = std::env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        PathBuf::from(custom_dir)
    } else {
        std::env::current_dir().unwrap_or_default().join("data")
    };
    let images_dir = base_data_dir.join("user_images");

    let app_clone = app.clone();
    let on_progress = std::sync::Arc::new(move |progress: MediaSyncProgress| {
        let _ = app_clone.emit("sync-media-progress", progress);
    });

    sync_media_to_yandex_inner(&token, &images_dir, None, Some(on_progress))
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn list_yandex_disk_backups(token: String) -> Result<Vec<YandexBackupFile>, IpcError> {
    list_yandex_disk_backups_inner(&token, None)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn download_and_restore_yandex(
    token: String,
    file_name: String,
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), IpcError> {
    let temp_file_path = download_yandex_file_inner(&token, &file_name, None)
        .await
        .map_err(IpcError::from)?;

    let db = &state.services.db;
    restore_from_backup_inner(db, &temp_file_path.to_string_lossy())
        .await
        .map_err(IpcError::from)?;

    // Download any missing media files referenced in the backup manifest from app:/media/
    if let Err(e) = download_missing_media_inner(&token, &temp_file_path, None).await {
        eprintln!("[BACKUP] Warning: failed to download some media files: {e}");
    }

    if let Some(dir) = temp_file_path.parent()
        && let Err(e) = fs::remove_dir_all(dir) {
            eprintln!("[BACKUP] Temp dir clean error: {e}");
        }

    Ok(())
}

#[tauri::command]
pub async fn restore_from_backup(
    backup_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), IpcError> {
    let db = &state.services.db;
    restore_from_backup_inner(db, &backup_path)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub fn get_launch_args() -> Option<String> {
    std::env::args().skip(1).find(|arg| arg.ends_with(".wwiki"))
}
