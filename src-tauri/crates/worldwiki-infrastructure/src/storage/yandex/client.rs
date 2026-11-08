use std::env;
use std::fs;
use std::path::PathBuf;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::storage::YandexBackupFile;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MediaSyncProgress {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    #[serde(default)]
    pub active_files: Vec<String>,
}

pub type ProgressCallback = std::sync::Arc<dyn Fn(MediaSyncProgress) + Send + Sync>;

/// Базовый URL REST API Яндекс.Диска.
pub(crate) fn disk_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://cloud-api.yandex.net").to_string()
}

/// Загрузка одиночного файла на Диск с переданным переиспользуемым HTTP-клиентом.
pub async fn upload_single_file_with_client(
    client: &reqwest::Client,
    token: &str,
    local_path: &std::path::Path,
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
    local_path: &std::path::Path,
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

/// Инкрементальная параллельная синхронизация локальной папки user_images с облачной папкой app:/media/
pub async fn sync_media_to_yandex_inner(
    token: &str,
    local_images_dir: &std::path::Path,
    base_override: Option<&str>,
    on_progress: Option<ProgressCallback>,
) -> Result<usize, DomainError> {
    if !local_images_dir.exists() {
        return Ok(0);
    }
    ensure_yandex_dir_inner(token, "app:/media", base_override).await?;
    let existing_remote = list_yandex_dir_files_inner(token, "app:/media", base_override).await?;

    let entries = match fs::read_dir(local_images_dir) {
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

    // Параллельная загрузка (до 4 потоков) для предотвращения рейтлимитов Яндекс.Диска
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));
    let completed_count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let token_arc = std::sync::Arc::new(token.to_string());
    let base_arc = base_override.map(|s| std::sync::Arc::new(s.to_string()));
    let client = std::sync::Arc::new(reqwest::Client::new());
    let active_files = std::sync::Arc::new(tokio::sync::Mutex::new(std::collections::BTreeSet::<String>::new()));

    let mut tasks = Vec::new();

    for (path, file_name) in files_to_upload {
        let sem = semaphore.clone();
        let tok = token_arc.clone();
        let base = base_arc.clone();
        let on_progress_cb = on_progress.clone();
        let comp = completed_count.clone();
        let cli = client.clone();
        let active = active_files.clone();

        tasks.push(tokio::spawn(async move {
            let _permit = sem
                .acquire()
                .await
                .map_err(|e| DomainError::Validation(e.to_string()))?;

            {
                let mut act = active.lock().await;
                act.insert(file_name.clone());
                if let Some(ref cb) = on_progress_cb {
                    let current_idx = comp.load(std::sync::atomic::Ordering::Relaxed);
                    cb(MediaSyncProgress {
                        current: current_idx,
                        total,
                        current_file: file_name.clone(),
                        active_files: act.iter().cloned().collect(),
                    });
                }
            }

            let remote_path = format!("app:/media/{}", file_name);
            let base_ref = base.as_deref().map(|s| s.as_str());
            upload_single_file_with_client(&cli, &tok, &path, &remote_path, base_ref).await?;

            {
                let mut act = active.lock().await;
                act.remove(&file_name);
                let new_count = comp.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                if let Some(ref cb) = on_progress_cb {
                    cb(MediaSyncProgress {
                        current: new_count,
                        total,
                        current_file: file_name,
                        active_files: act.iter().cloned().collect(),
                    });
                }
            }

            Ok::<(), DomainError>(())
        }));
    }

    let mut final_uploaded = 0;
    for task in tasks {
        match task.await {
            Ok(res) => {
                res?;
                final_uploaded += 1;
            }
            Err(e) => return Err(DomainError::Validation(format!("Upload task failed: {e}"))),
        }
    }

    Ok(final_uploaded)
}

/// Загрузка бэкапа на Диск: запрос upload-ссылки -> PUT файла.
pub async fn upload_to_yandex_disk_inner(
    token: &str,
    file_path: &str,
    base_override: Option<&str>,
) -> Result<(), DomainError> {
    let path = std::path::Path::new(file_path);
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

fn get_base_data_dir() -> PathBuf {
    if let Ok(custom_dir) = env::var("SURREAL_DATA_DIR")
        && !custom_dir.is_empty()
    {
        return PathBuf::from(custom_dir);
    }
    env::current_dir().unwrap_or_default().join("data")
}

/// Скачивает недостающие медиафайлы из app:/media/ согласно manifest.json в архиве
pub async fn download_missing_media_inner(
    token: &str,
    backup_zip_path: &std::path::Path,
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
        let target_file_path = local_images_dir.join(name);
        if target_file_path.exists() {
            continue;
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
            _ => continue,
        };

        if let Ok(url_json) = url_res.json::<serde_json::Value>().await
            && let Some(download_url) = url_json.get("href").and_then(|v| v.as_str())
            && let Ok(file_res) = client.get(download_url).send().await
            && file_res.status().is_success()
            && let Ok(file_bytes) = file_res.bytes().await
            && fs::write(&target_file_path, file_bytes).is_ok()
        {
            downloaded_count += 1;
        }
    }

    Ok(downloaded_count)
}
