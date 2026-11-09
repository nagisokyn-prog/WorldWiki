//! Low-level HTTP primitives for Yandex.Disk REST API communication.

use std::fs;
use std::path::Path;
use worldwiki_domain::errors::DomainError;

/// Базовый URL REST API Яндекс.Диска.
pub fn disk_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://cloud-api.yandex.net").to_string()
}

/// Загрузка одиночного файла на Диск с переданным переиспользуемым HTTP-клиентом.
pub async fn upload_single_file_with_client(
    client: &reqwest::Client,
    token: &str,
    local_path: &Path,
    remote_path: &str,
    base_override: Option<&str>,
) -> Result<(), DomainError> {
    if !local_path.exists() {
        return Err(DomainError::Validation(format!(
            "File does not exist: {}",
            local_path.display()
        )));
    }

    // 1. Get upload URL
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources/upload?path={}&overwrite=true",
            disk_base(base_override),
            remote_path
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to get upload URL: {e}")))?;

    if url_res.status() == 401 {
        return Err(DomainError::Validation("Token expired or invalid".to_string()));
    }

    let url_json: serde_json::Value =
        url_res.json().await.map_err(|e| DomainError::Validation(format!("JSON error: {e}")))?;
    let upload_url = url_json
        .get("href")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            let msg = url_json
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Failed to get upload link");
            DomainError::Validation(msg.to_string())
        })?;

    // 2. Upload file
    let file_content = fs::read(local_path).map_err(|e| DomainError::Validation(format!("Failed to read file: {e}")))?;

    let upload_res = client
        .put(upload_url)
        .body(file_content)
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to upload file: {e}")))?;

    if upload_res.status().is_success() {
        Ok(())
    } else {
        Err(DomainError::Validation(format!("Upload failed with status: {}", upload_res.status())))
    }
}

/// Загрузка одиночного файла на Диск по целевому пути (например app:/media/pic.png или app:/backup.wwiki).
pub async fn upload_single_file_to_yandex(
    token: &str,
    local_path: &Path,
    remote_path: &str,
    base_override: Option<&str>,
) -> Result<(), DomainError> {
    let client = reqwest::Client::new();
    upload_single_file_with_client(&client, token, local_path, remote_path, base_override).await
}

/// Гарантирует существование директории в облаке (например "app:/media")
pub async fn ensure_yandex_dir_inner(
    token: &str,
    dir_path: &str,
    base_override: Option<&str>,
) -> Result<(), DomainError> {
    let client = reqwest::Client::new();
    let res = client
        .put(format!(
            "{}/v1/disk/resources?path={}",
            disk_base(base_override),
            dir_path
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to create folder: {e}")))?;

    if res.status().is_success() || res.status() == 409 {
        Ok(())
    } else if res.status() == 401 {
        Err(DomainError::Validation("Token expired or invalid".to_string()))
    } else {
        Err(DomainError::Validation(format!("Create dir failed: {}", res.status())))
    }
}

/// Список имен файлов в заданной облачной папке (например "app:/media")
pub async fn list_yandex_dir_files_inner(
    token: &str,
    dir_path: &str,
    base_override: Option<&str>,
) -> Result<std::collections::HashSet<String>, DomainError> {
    let client = reqwest::Client::new();
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources?path={}&limit=1000",
            disk_base(base_override),
            dir_path
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| DomainError::Validation(format!("Failed to list folder: {e}")))?;

    if url_res.status() == 404 {
        return Ok(std::collections::HashSet::new());
    }
    if !url_res.status().is_success() {
        return Err(DomainError::Validation(format!("Yandex API error: {}", url_res.status())));
    }

    let json: serde_json::Value = url_res
        .json()
        .await
        .map_err(|e| DomainError::Validation(format!("JSON error: {e}")))?;

    let mut set = std::collections::HashSet::new();
    if let Some(items) = json
        .get("_embedded")
        .and_then(|e| e.get("items"))
        .and_then(|i| i.as_array())
    {
        for item in items {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                set.insert(name.to_string());
            }
        }
    }
    Ok(set)
}

