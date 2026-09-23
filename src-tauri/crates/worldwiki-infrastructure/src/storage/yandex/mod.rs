pub mod auth;
pub mod client;

pub use auth::*;
pub use client::*;

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
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
        let _server_task = tokio::spawn(async move {
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
                if let Err(e) = s.write_all(resp.as_bytes()).await {
                    eprintln!("[MOCK SERVER] Write error: {e}");
                }
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
        assert_eq!(err.to_string(), "Validation error: Код подтверждения неверен");
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

        if let Err(e) = fs::remove_dir_all(&dir) {
            eprintln!("[TEST CLEANUP] Error removing test dir: {e}");
        }
    }
}
