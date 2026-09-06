use std::env;
use std::fs;
use std::path::PathBuf;
use worldwiki_domain::storage::YandexBackupFile;

pub const YANDEX_CLIENT_ID: &str = "200295d252b44387a21ec64a80d7d124";
pub const YANDEX_CLIENT_SECRET: &str = "2c1d8dd57f5e4271a74249f6c4b58895";

/// Базовый URL OAuth-эндпоинта; `base_override` подменяет его в тестах.
fn oauth_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://oauth.yandex.ru").to_string()
}

/// Базовый URL REST API Яндекс.Диска.
fn disk_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://cloud-api.yandex.net").to_string()
}

/// Обмен authorization code на access token.
pub async fn exchange_yandex_token_inner(
    code: &str,
    base_override: Option<&str>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", YANDEX_CLIENT_ID),
        ("client_secret", YANDEX_CLIENT_SECRET),
    ];

    let res = client
        .post(format!("{}/token", oauth_base(base_override)))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let json: serde_json::Value = res.json().await.map_err(|e| format!("JSON error: {e}"))?;

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

/// Загрузка бэкапа на Диск: запрос upload-ссылки -> PUT файла.
pub async fn upload_to_yandex_disk_inner(
    token: &str,
    file_path: &str,
    base_override: Option<&str>,
) -> Result<(), String> {
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    let client = reqwest::Client::new();

    // 1. Get upload URL
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources/upload?path=app:/{}&overwrite=true",
            disk_base(base_override),
            file_name
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| format!("Failed to get upload URL: {e}"))?;

    if url_res.status() == 401 {
        return Err("Token expired or invalid".to_string());
    }

    let url_json: serde_json::Value =
        url_res.json().await.map_err(|e| format!("JSON error: {e}"))?;
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
    let file_content = fs::read(file_path).map_err(|e| format!("Failed to read file: {e}"))?;

    let upload_res = client
        .put(upload_url)
        .header("Content-Type", "application/zip")
        .body(file_content)
        .send()
        .await
        .map_err(|e| format!("Failed to upload file: {e}"))?;

    if upload_res.status().is_success() {
        Ok(())
    } else {
        Err(format!("Upload failed with status: {}", upload_res.status()))
    }
}

/// Список бэкапов в app:-папке Диска (.wwiki/.zip), новейшие первыми.
pub async fn list_yandex_disk_backups_inner(
    token: &str,
    base_override: Option<&str>,
) -> Result<Vec<YandexBackupFile>, String> {
    let client = reqwest::Client::new();
    let url_res = client
        .get(format!(
            "{}/v1/disk/resources?path=app:/&limit=100",
            disk_base(base_override)
        ))
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|e| format!("Failed to get directory listing: {e}"))?;

    if url_res.status() == 404 {
        return Ok(vec![]);
    }

    if !url_res.status().is_success() {
        return Err(format!("Yandex API error: {}", url_res.status()));
    }

    let json: serde_json::Value =
        url_res.json().await.map_err(|e| format!("JSON error: {e}"))?;

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

/// Скачивает файл бэкапа во временную папку и возвращает путь к нему.
pub async fn download_yandex_file_inner(
    token: &str,
    file_name: &str,
    base_override: Option<&str>,
) -> Result<PathBuf, String> {
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
        .map_err(|e| format!("Failed to get download URL: {e}"))?;

    if !url_res.status().is_success() {
        return Err(format!("Download URL request failed: {}", url_res.status()));
    }

    let url_json: serde_json::Value =
        url_res.json().await.map_err(|e| format!("JSON error: {e}"))?;
    let download_url = url_json
        .get("href")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get download link".to_string())?;

    // 2. Download file contents
    let file_res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {e}"))?;
    if !file_res.status().is_success() {
        return Err(format!("Download failed: {}", file_res.status()));
    }

    let file_bytes = file_res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded bytes: {e}"))?;

    // 3. Save to temp file
    let temp_dir = env::temp_dir().join(format!(
        "wwiki_download_{}",
        chrono::Local::now().timestamp_millis() + std::process::id() as i64
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let temp_file_path = temp_dir.join(file_name);
    fs::write(&temp_file_path, file_bytes)
        .map_err(|e| format!("Failed to save temp file: {e}"))?;

    Ok(temp_file_path)
}

#[cfg(test)]
mod yandex_tests {
    use super::*;
    use std::sync::Arc;

    type SharedBuf = Arc<tokio::sync::Mutex<Vec<u8>>>;

    fn reserve_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    async fn spawn_mock_seq_on(
        port: u16,
        responses: Vec<(u16, String)>,
        captured: SharedBuf,
    ) {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.unwrap();
        let queue = Arc::new(tokio::sync::Mutex::new(responses));
        tokio::spawn(async move {
            for _ in 0..10 {
                let mut s = match listener.accept().await {
                    Ok((s, _)) => s,
                    Err(_) => break,
                };
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = vec![0u8; 65536];
                let mut total = 0;
                loop {
                    let n = match s.read(&mut buf[total..]).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => n,
                    };
                    total += n;
                    if buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
                        break;
                    }
                }
                if total > 0 {
                    captured.lock().await.extend_from_slice(&buf[..total]);
                }
                let mut q = queue.lock().await;
                let (status, body) = if q.len() <= 1 {
                    q.first().cloned().unwrap_or((200u16, "{}".to_string()))
                } else {
                    q.remove(0)
                };
                let reason = if status == 200 { "OK" } else { "Error" };
                let resp = format!(
                    "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = s.write_all(resp.as_bytes()).await;
                drop(s);
            }
        });
    }

    fn captured_str(captured: &SharedBuf) -> String {
        String::from_utf8_lossy(&captured.try_lock().unwrap()).into_owned()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn oauth_exchange_success_returns_token() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(
            port,
            vec![(200, r#"{"access_token":"tok-123"}"#.to_string())],
            captured.clone(),
        )
        .await;
        let base = format!("http://127.0.0.1:{port}");

        let token = exchange_yandex_token_inner("ABC-CODE", Some(&base))
            .await
            .expect("успешный обмен кода");
        assert_eq!(token, "tok-123");

        let req = captured_str(&captured);
        assert!(req.contains("grant_type=authorization_code"), "{req}");
        assert!(req.contains("code=ABC-CODE"), "{req}");
        assert!(req.contains(&format!("client_id={YANDEX_CLIENT_ID}")), "{req}");
        assert!(req.to_ascii_lowercase().contains("post /token"), "{req}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn oauth_exchange_error_description_surfaced() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(
            port,
            vec![(
                400,
                r#"{"error_description":"Код подтверждения неверен"}"#.to_string(),
            )],
            captured.clone(),
        )
        .await;
        let base = format!("http://127.0.0.1:{port}");

        let err = exchange_yandex_token_inner("BAD", Some(&base))
            .await
            .expect_err("ошибка OAuth -> Err");
        assert_eq!(err, "Код подтверждения неверен");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn upload_success_puts_file_to_href() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        let base = format!("http://127.0.0.1:{port}");
        spawn_mock_seq_on(
            port,
            vec![
                (200, format!(r#"{{"href":"{base}/put-target"}}"#)),
                (200, "{}".to_string()),
            ],
            captured.clone(),
        )
        .await;

        let dir = env::temp_dir().join(format!("wwiki_up_test_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("backup.wwiki");
        fs::write(&file_path, b"ZIPBYTES").unwrap();
        let file_path_str = file_path.to_string_lossy().to_string();

        upload_to_yandex_disk_inner("tok-up", &file_path_str, Some(&base))
            .await
            .expect("upload должен пройти");

        let req = captured_str(&captured);
        assert!(
            req.contains("authorization: OAuth tok-up"),
            "OAuth-заголовок: {req}"
        );
        assert!(req.contains("/v1/disk/resources/upload?path=app:/backup.wwiki"), "{req}");
        assert!(req.to_ascii_lowercase().contains("put /put-target"), "PUT файла: {req}");
        assert!(req.contains("ZIPBYTES"), "байты файла отправлены");

        let _ = fs::remove_dir_all(dir);
    }
}
