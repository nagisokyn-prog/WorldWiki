//! Media synchronization and download functionality between local storage and Yandex.Disk.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use worldwiki_domain::errors::DomainError;

use super::http::{disk_base, ensure_yandex_dir_inner, list_yandex_dir_files_inner, upload_single_file_with_client};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MediaSyncProgress {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    #[serde(default)]
    pub active_files: Vec<String>,
}

pub type ProgressCallback = std::sync::Arc<dyn Fn(MediaSyncProgress) + Send + Sync>;

fn get_base_data_dir() -> PathBuf {
    if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        return PathBuf::from(custom_dir);
    }
    env::current_dir().unwrap_or_default().join("data")
}

/// Инкрементальная последовательная синхронизация локальной папки user_images с облачной папкой app:/media/
pub async fn sync_media_to_yandex_inner(
    token: &str,
    local_images_dir: Option<&Path>,
    base_override: Option<&str>,
    on_progress: Option<ProgressCallback>,
) -> Result<usize, DomainError> {
    let default_dir = get_base_data_dir().join("user_images");
    let target_dir = local_images_dir.unwrap_or(&default_dir);
    if !target_dir.exists() {
        return Ok(0);
    }
    ensure_yandex_dir_inner(token, "app:/media", base_override).await?;
    let existing_remote = list_yandex_dir_files_inner(token, "app:/media", base_override).await?;

    let entries = match fs::read_dir(target_dir) {
        Ok(read_dir) => read_dir,
        Err(_) => return Ok(0),
    };

    let mut files_to_upload = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        if !existing_remote.contains(&file_name) {
            files_to_upload.push((path, file_name));
        }
    }

    let total = files_to_upload.len();
    if total == 0 {
        if let Some(ref cb) = on_progress {
            cb(MediaSyncProgress {
                current: 0,
                total: 0,
                current_file: String::new(),
                active_files: Vec::new(),
            });
        }
        return Ok(0);
    }

    // Последовательная синхронизация медиафайлов: предотвращает 429 Rate Limit и оверхед параллелизма
    let client = reqwest::Client::new();
    let mut final_uploaded = 0;

    for (path, file_name) in files_to_upload {
        let remote_path = format!("app:/media/{file_name}");
        upload_single_file_with_client(&client, token, &path, &remote_path, base_override).await?;
        final_uploaded += 1;
        if let Some(ref cb) = on_progress {
            cb(MediaSyncProgress {
                current: final_uploaded,
                total,
                current_file: file_name,
                active_files: Vec::new(),
            });
        }
    }

    Ok(final_uploaded)
}

async fn download_and_save_media_file(
    client: &reqwest::Client,
    token: &str,
    base_override: Option<&str>,
    local_images_dir: &Path,
    name: &str,
) -> Result<bool, DomainError> {
    let target_file_path = local_images_dir.join(name);
    if target_file_path.exists() {
        return Ok(false);
    }

    let url_res = client
        .get(format!(
            "{}/v1/disk/resources/download?path=app:/media/{}",
            disk_base(base_override),
            name
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await;

    let url_res = match url_res {
        Ok(r) if r.status().is_success() => r,
        _ => return Ok(false),
    };

    let url_json: serde_json::Value = match url_res.json().await {
        Ok(j) => j,
        Err(_) => return Ok(false),
    };

    let download_url = match url_json.get("href").and_then(|v| v.as_str()) {
        Some(url) => url,
        None => return Ok(false),
    };

    let file_res = match client.get(download_url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Ok(false),
    };

    let file_bytes = match file_res.bytes().await {
        Ok(b) => b,
        Err(_) => return Ok(false),
    };

    tokio::fs::write(&target_file_path, file_bytes)
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to save media file: {e}")))?;

    Ok(true)
}

/// Скачивает недостающие медиафайлы из app:/media/ согласно manifest.json в архиве
pub async fn download_missing_media_inner(
    token: &str,
    backup_zip_path: &Path,
    base_override: Option<&str>,
) -> Result<usize, DomainError> {
    let file = fs::File::open(backup_zip_path)
        .map_err(|e| DomainError::Validation(format!("Failed to open backup zip: {e}")))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| DomainError::Validation(format!("Failed to read backup zip: {e}")))?;

    let mut manifest_file = match zip.by_name("manifest.json") {
        Ok(f) => f,
        Err(_) => return Ok(0), // Legacy archive without manifest
    };

    let mut manifest_str = String::new();
    use std::io::Read;
    manifest_file
        .read_to_string(&mut manifest_str)
        .map_err(|e| DomainError::Validation(format!("Failed to read manifest: {e}")))?;

    let manifest_json: serde_json::Value = serde_json::from_str(&manifest_str)
        .map_err(|e| DomainError::Validation(format!("Failed to parse manifest: {e}")))?;

    let media_files = match manifest_json.get("media_files").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Ok(0),
    };

    let base_data_dir = get_base_data_dir();
    let local_images_dir = base_data_dir.join("user_images");
    let _ = fs::create_dir_all(&local_images_dir);

    let client = reqwest::Client::new();
    let mut downloaded_count = 0;

    for item in media_files {
        let name = match item.as_str() {
            Some(n) => n,
            None => continue,
        };
        if download_and_save_media_file(&client, token, base_override, &local_images_dir, name).await.unwrap_or(false) {
            downloaded_count += 1;
        }
    }

    Ok(downloaded_count)
}

