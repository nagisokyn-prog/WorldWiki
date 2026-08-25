//! IPC layer for module `export`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;

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

#[tauri::command]
pub async fn upload_to_yandex_disk(token: String, file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Backup file does not exist".to_string());
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

