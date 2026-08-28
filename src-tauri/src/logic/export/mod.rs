use serde_json::Value;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use tauri::Manager; // Важно для работы с путями в Tauri 2.0

// IPC layer extracted (architecture split):
mod commands;
pub use commands::*;

/// Тестируемое ядро `export_chapters` (без `tauri::AppHandle`).
///
/// Пишет объединённые главы в `exported_chapters.<format>` внутри `target_dir`.
pub fn export_chapters_inner(
    target_dir: &Path,
    chapters: &[Value],
    format: &str,
) -> Result<String, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let file_path = target_dir.join(format!("exported_chapters.{}", format));
    let mut combined_content = String::new();

    for chapter in chapters {
        let title = chapter
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Без названия");
        let content = chapter
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        combined_content.push_str(&format!("\n\n=== {} ===\n\n{}\n", title, content));
    }

    // Сохраняем файл
    fs::write(&file_path, combined_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Тестируемое ядро `create_cloud_backup` (без `tauri::State`/`AppHandle`).
///
/// Экспортирует дамп БД в `.surql`, упаковывает его в `.wwiki` (zip)
/// вместе с картинками и настройками, возвращает путь к созданному файлу.
pub async fn create_cloud_backup_inner(
    db: &Surreal<Db>,
    target_dir: &Path,
) -> Result<String, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let temp_surql_path = target_dir.join(format!("backup_{}.surql", timestamp));

    // In SurrealDB v3, exporting to a file
    db.export(temp_surql_path.to_str().unwrap())
        .await
        .map_err(|e| e.to_string())?;

    let zip_path = target_dir.join(format!("WorldWiki_Backup_{}.wwiki", timestamp));
    let file =
        fs::File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. Add database dump
    if let Ok(dump_content) = fs::read(&temp_surql_path) {
        zip.start_file("database.surql", options)
            .map_err(|e| e.to_string())?;
        zip.write_all(&dump_content).map_err(|e| e.to_string())?;
    }

    // Clean up temporary dump
    let _ = fs::remove_file(&temp_surql_path);

    // 2. Add user images (if any)
    let images_dir = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("user_images");
    if images_dir.exists() {
        // recursively add images
        if let Ok(entries) = fs::read_dir(&images_dir) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Ok(content) = fs::read(entry.path()) {
                            let name = format!("images/{}", entry.file_name().to_string_lossy());
                            if zip.start_file(name, options).is_ok() {
                                let _ = zip.write_all(&content);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Add settings files
    let data_dir = env::current_dir().unwrap_or_default().join("data");
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.filter_map(Result::ok) {
            if entry.file_name().to_string_lossy().ends_with(".json") {
                if let Ok(content) = fs::read(entry.path()) {
                    let name = format!("settings/{}", entry.file_name().to_string_lossy());
                    if zip.start_file(name, options).is_ok() {
                        let _ = zip.write_all(&content);
                    }
                }
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(zip_path.to_string_lossy().to_string())
}

pub(crate) const YANDEX_CLIENT_ID: &str = "200295d252b44387a21ec64a80d7d124";
pub(crate) const YANDEX_CLIENT_SECRET: &str = "2c1d8dd57f5e4271a74249f6c4b58895";
// ---------------------------------------------------------------------------
// Yandex Disk / OAuth: тестируемые ядра (base_override для мок-сервера)
// ---------------------------------------------------------------------------

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


/// Загрузка бэкапа на Диск: запрос upload-ссылки → PUT файла.
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

#[derive(serde::Serialize, Debug)]
pub struct YandexBackupFile {
    pub name: String,
    pub created: String,
    pub size: u64,
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
/// Восстановление (restore_from_backup_inner) и очистка — на стороне вызова.
pub async fn download_yandex_file_inner(
    token: &str,
    file_name: &str,
    base_override: Option<&str>,
) -> Result<std::path::PathBuf, String> {
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

    // 3. Save to temp file (timestamp + pid — уникальность между тестами)
    let temp_dir = env::temp_dir().join(format!(
        "wwiki_download_{}",
        chrono::Local::now().timestamp_millis() as i64 + std::process::id() as i64
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let temp_file_path = temp_dir.join(file_name);
    fs::write(&temp_file_path, file_bytes)
        .map_err(|e| format!("Failed to save temp file: {e}"))?;

    Ok(temp_file_path)
}

/// Тестируемое ядро `restore_from_backup` (без `tauri::State`).
///
/// Открывает `.wwiki` (zip), извлекает `database.surql` и импортирует его в БД.
pub async fn restore_from_backup_inner(
    db: &Surreal<Db>,
    backup_path: &str,
) -> Result<(), String> {
    let path = std::path::Path::new(backup_path);
    if !path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let file = fs::File::open(path).map_err(|e| format!("Failed to open backup: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    let temp_dir = env::temp_dir().join(format!(
        "wwiki_restore_{}",
        chrono::Local::now().timestamp()
    ));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // 1. Extract database.surql
    let mut surql_found = false;
    let surql_path = temp_dir.join("database.surql");

    for i in 0..zip.len() {
        let mut file = zip.by_index(i).map_err(|e| e.to_string())?;
        let file_name = file.name().to_string();

        if file_name == "database.surql" {
            let mut out = fs::File::create(&surql_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            surql_found = true;
        } else if file_name.starts_with("images/") {
            let out_path = env::current_dir()
                .unwrap_or_default()
                .join("data")
                .join("user_images")
                .join(file_name.trim_start_matches("images/"));
            if let Some(p) = out_path.parent() {
                fs::create_dir_all(p).ok();
            }
            if let Ok(mut out) = fs::File::create(&out_path) {
                std::io::copy(&mut file, &mut out).ok();
            }
        } else if file_name.starts_with("settings/") {
            let out_path = env::current_dir()
                .unwrap_or_default()
                .join("data")
                .join(file_name.trim_start_matches("settings/"));
            if let Some(p) = out_path.parent() {
                fs::create_dir_all(p).ok();
            }
            if let Ok(mut out) = fs::File::create(&out_path) {
                std::io::copy(&mut file, &mut out).ok();
            }
        }
    }

    if !surql_found {
        return Err("Invalid backup file: database.surql not found".to_string());
    }

    // SurrealDB export пишет и родительское поле, и вложенное (`tool_logs` +
    // `tool_logs.*`). При повторном импорте v3 считает `.*`-определение
    // конфликтом типов с родителем. Родительский DEFINE уже покрывает вложенные
    // поля, поэтому безопасно вырезать все `DEFINE FIELD <table>.*` из дампа.
    let raw_dump = fs::read_to_string(&surql_path)
        .map_err(|e| format!("Failed to read dump: {e}"))?;
    let sanitized: String = raw_dump
        .lines()
        .filter(|line| {
            let t = line.trim_start();
            !(t.starts_with("DEFINE FIELD")
                && t.contains("OVERWRITE")
                && t.split_whitespace().nth(3).is_some_and(|f| f.ends_with(".*")))
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&surql_path, sanitized).map_err(|e| format!("Failed to write dump: {e}"))?;

    // Clear current database before importing to prevent duplicates?
    // In SurrealDB, importing a dump usually overwrites records with the same ID,
    // but we might want to clear it first. Let's assume import handles it.
    db.import(surql_path.to_str().unwrap())
        .await
        .map_err(|e| format!("Database import failed: {}", e))?;

    // Clean up
    let _ = fs::remove_dir_all(temp_dir);

    Ok(())
}


#[cfg(test)]
mod yandex_tests {
    use super::*;
    use std::sync::Arc;

    type SharedBuf = Arc<tokio::sync::Mutex<Vec<u8>>>;

    /// Резервирует свободный порт (для подстановки в href до старта сервера).
    fn reserve_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    /// Mock-сервер с очередью ответов (status, body): каждый запрос съедает
    /// один элемент, последний повторяется. Захват запросов → `captured`.
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
                // Первый необработанный ответ; последний повторяется.
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
            .expect_err("ошибка OAuth → Err");
        assert_eq!(err, "Код подтверждения неверен");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn oauth_exchange_fallback_error_field() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(
            port,
            vec![(400, r#"{"error":"unauthorized_client"}"#.to_string())],
            captured,
        )
        .await;
        let base = format!("http://127.0.0.1:{port}");

        let err = exchange_yandex_token_inner("X", Some(&base)).await.expect_err("Err");
        assert_eq!(err, "unauthorized_client", "fallback на поле error");
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

        // Временный файл-«бэкап»
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

    #[tokio::test(flavor = "multi_thread")]
    async fn upload_missing_file_is_err() {
        let err = upload_to_yandex_disk_inner("t", "Z:/no/such/file.wwiki", None)
            .await
            .expect_err("нет файла → Err");
        assert!(err.contains("does not exist"), "{err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn upload_401_reports_token_expired() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(
            port,
            vec![(401, r#"{"message":"unauthorized"}"#.to_string())],
            captured,
        )
        .await;
        let base = format!("http://127.0.0.1:{port}");

        let dir = env::temp_dir().join(format!("wwiki_up401_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let fp = dir.join("b.wwiki");
        fs::write(&fp, b"x").unwrap();

        let err = upload_to_yandex_disk_inner("bad", &fp.to_string_lossy(), Some(&base))
            .await
            .expect_err("401 → Err");
        assert!(err.contains("Token expired"), "{err}");

        let _ = fs::remove_dir_all(dir);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn list_filters_extensions_and_sorts_desc() {
        let captured: SharedBuf = Default::default();
        let body = r#"{"_embedded":{"items":[
            {"name":"old.wwiki","created":"2026-01-01T00:00:00Z","size":10},
            {"name":"new.zip","created":"2026-05-05T00:00:00Z","size":20},
            {"name":"notes.txt","created":"2026-06-06T00:00:00Z","size":5},
            {"name":"no-size.wwiki","created":"2026-07-07T00:00:00Z"}
        ]}}"#;
        let base = {
            let port = reserve_port();
            spawn_mock_seq_on(port, vec![(200, body.to_string())], captured.clone()).await;
            format!("http://127.0.0.1:{port}")
        };

        let list = list_yandex_disk_backups_inner("tok-list", Some(&base))
            .await
            .expect("список должен получиться");

        assert_eq!(list.len(), 2, "только .wwiki/.zip и с size: {list:?}");
        assert_eq!(list[0].name, "new.zip", "новейшие первыми");
        assert_eq!(list[1].name, "old.wwiki");
        assert_eq!(list[1].size, 10);

        let req = captured_str(&captured);
        assert!(req.contains("authorization: OAuth tok-list"), "{req}");
        assert!(req.contains("path=app:/&limit=100"), "{req}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn list_404_means_empty_folder() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(port, vec![(404, "{}".to_string())], captured).await;
        let base = format!("http://127.0.0.1:{port}");

        let list = list_yandex_disk_backups_inner("t", Some(&base)).await.unwrap();
        assert!(list.is_empty(), "404 трактуется как пустая папка");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn list_500_is_err() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        spawn_mock_seq_on(port, vec![(500, "{}".to_string())], captured).await;
        let base = format!("http://127.0.0.1:{port}");

        let err = list_yandex_disk_backups_inner("t", Some(&base))
            .await
            .expect_err("500 → Err");
        assert!(err.contains("Yandex API error"), "{err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn download_saves_file_and_returns_path() {
        let captured: SharedBuf = Default::default();
        let port = reserve_port();
        let base = format!("http://127.0.0.1:{port}");
        spawn_mock_seq_on(
            port,
            vec![
                (200, format!(r#"{{"href":"{base}/dl-target"}}"#)), // ответ на первый GET
                (200, "FAKE-ZIP-CONTENT".to_string()), // повторится для второго GET
            ],
            captured.clone(),
        )
        .await;

        let path = download_yandex_file_inner("tok-dl", "backup.wwiki", Some(&base))
            .await
            .expect("файл скачан");

        assert!(path.exists(), "temp-файл существует: {path:?}");
        assert_eq!(fs::read(&path).unwrap(), b"FAKE-ZIP-CONTENT");

        let req = captured_str(&captured);
        assert!(
            req.contains("/v1/disk/resources/download?path=app:/backup.wwiki"),
            "{req}"
        );
        assert!(req.contains("authorization: OAuth tok-dl"), "{req}");

        // cleanup
        if let Some(dir) = path.parent() {
            let _ = fs::remove_dir_all(dir);
        }
    }
}

