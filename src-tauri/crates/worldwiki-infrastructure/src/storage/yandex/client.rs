//! High-level client API for Yandex.Disk cloud backup operations.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::storage::YandexBackupFile;

use super::http::{disk_base, upload_single_file_to_yandex};

pub use super::auth::exchange_yandex_token_inner;
pub use super::http::{
    ensure_yandex_dir_inner, list_yandex_dir_files_inner, upload_single_file_to_yandex as upload_single_file_to_yandex_inner,
    upload_single_file_with_client,
};
pub use super::media::{
    download_missing_media_inner, sync_media_to_yandex_inner, MediaSyncProgress, ProgressCallback,
};

/// Загрузка бэкапа на Диск: запрос upload-ссылки -> PUT файла.
pub async fn upload_to_yandex_disk_inner(
    token: &str,
    file_path: &str,
    base_override: Option<&str>,
) -> Result<(), DomainError> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(DomainError::Validation("Backup file does not exist".to_string()));
    }
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    upload_single_file_to_yandex(token, path, &format!("app:/{}", file_name), base_override).await
}

/// Список бэкапов в app:-папке Диска (.wwiki/.zip), новейшие первыми.
pub async fn list_yandex_disk_backups_inner(
    token: &str,
    base_override: Option<&str>,
) -> Result<Vec<YandexBackupFile>, DomainError> {
    let client = reqwest::Client::new();
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources?path=app:/&limit=100",
            disk_base(base_override)
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to get directory listing: {e}")))?;

    if url_res.status() == 404 {
        return Ok(vec![]);
    }

    if !url_res.status().is_success() {
        return Err(DomainError::Validation(format!("Yandex API error: {}", url_res.status())));
    }

    let json: serde_json::Value =
        url_res.json().await.map_err(|e| DomainError::Validation(format!("JSON error: {e}")))?;

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
            )
                && (name.ends_with(".wwiki") || name.ends_with(".zip")) {
                    backups.push(YandexBackupFile {
                        name: name.to_string(),
                        created: created.to_string(),
                        size,
                    });
                }
        }
    }

    // Sort descending (newest first)
    backups.sort_by(|a, b| b.created.cmp(&a.created));

    Ok(backups)
}

/// Скачивает файл бэкапа во временную папку и возвращает путь к нему.
pub async fn download_yandex_file_inner(
    token: &str,
    file_name: &str,
    base_override: Option<&str>,
) -> Result<PathBuf, DomainError> {
    let client = reqwest::Client::new();

    // 1. Get download URL
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources/download?path=app:/{}",
            disk_base(base_override),
            file_name
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to get download URL: {e}")))?;

    if !url_res.status().is_success() {
        return Err(DomainError::Validation(format!("Download URL request failed: {}", url_res.status())));
    }

    let url_json: serde_json::Value =
        url_res.json().await.map_err(|e| DomainError::Validation(format!("JSON error: {e}")))?;
    let download_url = url_json
        .get("href")
        .and_then(|v| v.as_str())
        .ok_or_else(|| DomainError::Validation("Failed to get download link".to_string()))?;

    // 2. Download file contents
    let file_res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to download file: {e}")))?;
    if !file_res.status().is_success() {
        return Err(DomainError::Validation(format!("Download failed: {}", file_res.status())));
    }

    let file_bytes = file_res
        .bytes()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to read downloaded bytes: {e}")))?;

    // 3. Save to temp file
    let temp_dir = env::temp_dir().join(format!(
        "wwiki_download_{}",
        chrono::Local::now().timestamp_millis() + std::process::id() as i64
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

    let temp_file_path = temp_dir.join(file_name);
    fs::write(&temp_file_path, file_bytes)
        .map_err(|e| DomainError::Validation(format!("Failed to save temp file: {e}")))?;

    Ok(temp_file_path)
}
