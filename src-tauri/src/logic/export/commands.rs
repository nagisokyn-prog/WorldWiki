//! IPC layer for module `export`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use std::env;
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
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("client_id", YANDEX_CLIENT_ID),
        ("client_secret", YANDEX_CLIENT_SECRET),
    ];

    let res = client
        .post("https://oauth.yandex.ru/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: serde_json::Value = res.json().await.map_err(|e| format!("JSON error: {}", e))?;

    if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
        Ok(token.to_string())
    } else {
        let err_desc = json
            .get("error_description")
            .or_else(|| json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("Invalid confirmation code");
        Err(err_desc.to_string())
    }
}

#[tauri::command]
pub async fn upload_to_yandex_disk(token: String, file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    let client = reqwest::Client::new();

    // 1. Get upload URL
    let url_res = client
        .get(format!(
            "https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/{}&overwrite=true",
            file_name
        ))
        .header("Authorization", format!("OAuth {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get upload URL: {}", e))?;

    if url_res.status() == 401 {
        return Err("Token expired or invalid".to_string());
    }

    let url_json: serde_json::Value = url_res
        .json()
        .await
        .map_err(|e| format!("JSON error: {}", e))?;
    let upload_url = url_json
        .get("href")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            url_json
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Failed to get upload link")
                .to_string()
        })?;

    // 2. Upload file
    let file_content = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let upload_res = client
        .put(upload_url)
        .header("Content-Type", "application/zip")
        .body(file_content)
        .send()
        .await
        .map_err(|e| format!("Failed to upload file: {}", e))?;

    if upload_res.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Upload failed with status: {}",
            upload_res.status()
        ))
    }
}

#[tauri::command]
pub async fn list_yandex_disk_backups(token: String) -> Result<Vec<YandexBackupFile>, String> {
    let client = reqwest::Client::new();
    let url_res = client
        .get("https://cloud-api.yandex.net/v1/disk/resources?path=app:/&limit=100")
        .header("Authorization", format!("OAuth {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get directory listing: {}", e))?;

    if url_res.status() == 404 {
        return Ok(vec![]);
    }

    if !url_res.status().is_success() {
        return Err(format!("Yandex API error: {}", url_res.status()));
    }

    let json: serde_json::Value = url_res
        .json()
        .await
        .map_err(|e| format!("JSON error: {}", e))?;

    let items = json
        .get("_embedded")
        .and_then(|e| e.get("items"))
        .and_then(|i| i.as_array());

    let mut backups = Vec::new();
    if let Some(items) = items {
        for item in items {
            if let (Some(name), Some(created), Some(size)) = (
                item.get("name").and_then(|n| n.as_str()),
                item.get("created").and_then(|c| c.as_str()),
                item.get("size").and_then(|s| s.as_u64()),
            ) {
                if name.ends_with(".wwiki") || name.ends_with(".zip") {
                    backups.push(YandexBackupFile {
                        name: name.to_string(),
                        created: created.to_string(),
                        size,
                    });
                }
            }
        }
    }

    // Sort descending (newest first)
    backups.sort_by(|a, b| b.created.cmp(&a.created));

    Ok(backups)
}

#[tauri::command]
pub async fn download_and_restore_yandex(
    token: String,
    file_name: String,
    _app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // 1. Get download URL
    let url_res = client
        .get(format!(
            "https://cloud-api.yandex.net/v1/disk/resources/download?path=app:/{}",
            file_name
        ))
        .header("Authorization", format!("OAuth {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get download URL: {}", e))?;

    if !url_res.status().is_success() {
        return Err(format!("Download URL request failed: {}", url_res.status()));
    }

    let url_json: serde_json::Value = url_res
        .json()
        .await
        .map_err(|e| format!("JSON error: {}", e))?;
    let download_url = url_json
        .get("href")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get download link".to_string())?;

    // 2. Download file contents
    let file_res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;
    if !file_res.status().is_success() {
        return Err(format!("Download failed: {}", file_res.status()));
    }

    let file_bytes = file_res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded bytes: {}", e))?;

    // 3. Save to temp file
    let temp_dir = env::temp_dir().join(format!(
        "wwiki_download_{}",
        chrono::Local::now().timestamp()
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let temp_file_path = temp_dir.join(&file_name);
    fs::write(&temp_file_path, file_bytes)
        .map_err(|e| format!("Failed to save temp file: {}", e))?;

    // 4. Call existing restore_from_backup logic
    restore_from_backup(temp_file_path.to_string_lossy().to_string(), state).await?;

    // 5. Cleanup
    let _ = fs::remove_dir_all(temp_dir);

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

