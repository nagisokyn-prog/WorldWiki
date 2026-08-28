use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Mutex;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct EmbedderConfig {
    pub endpoint: String,
    pub api_key: Option<String>,
    pub model: String,
    pub dimension: usize,
}

impl Default for EmbedderConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://127.0.0.1:8080/v1/embeddings".to_string(),
            api_key: None,
            model: "nemotron-3-embed-1b".to_string(),
            dimension: 2048,
        }
    }
}

pub struct EmbedderService {
    client: reqwest::Client,
    config: Mutex<EmbedderConfig>,
}

impl Default for EmbedderService {
    fn default() -> Self {
        Self::new(EmbedderConfig::default())
    }
}

impl EmbedderService {
    pub fn new(config: EmbedderConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_default(),
            config: Mutex::new(config),
        }
    }

    pub async fn update_config(&self, new_config: EmbedderConfig) {
        let mut cfg = self.config.lock().await;
        *cfg = new_config;
    }

    /// Embed search query with `query:` prefix (Nemotron standard)
    pub async fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        let prefixed = format!("query: {}", text.trim());
        self.embed_text(&prefixed).await
    }

    /// Embed document / chunk with `passage:` prefix (Nemotron standard)
    pub async fn embed_passage(&self, text: &str) -> Result<Vec<f32>, String> {
        let prefixed = format!("passage: {}", text.trim());
        self.embed_text(&prefixed).await
    }

    async fn embed_text(&self, text: &str) -> Result<Vec<f32>, String> {
        let cfg = self.config.lock().await.clone();

        let mut req = self
            .client
            .post(&cfg.endpoint)
            .json(&json!({
                "model": cfg.model,
                "input": text
            }));

        if let Some(key) = &cfg.api_key {
            if !key.trim().is_empty() {
                req = req.bearer_auth(key);
            }
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("Embedding service request error: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("Embedding service error ({status}): {err_text}"));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Invalid embedding response: {e}"))?;

        if let Some(vec_val) = body.get("data")
            .and_then(|d| d.get(0))
            .and_then(|item| item.get("embedding"))
            .and_then(|emb| emb.as_array())
        {
            let mut vec: Vec<f32> = vec_val
                .iter()
                .filter_map(|v| v.as_f64().map(|f| f as f32))
                .collect();

            // Perform L2 Normalization
            normalize_l2(&mut vec);
            Ok(vec)
        } else {
            Err("Failed to parse embedding vector from response".to_string())
        }
    }
}

pub fn normalize_l2(vec: &mut [f32]) {
    let norm_sq: f32 = vec.iter().map(|x| x * x).sum();
    let norm = norm_sq.sqrt();
    if norm > 1e-12 {
        let inv = 1.0 / norm;
        for x in vec.iter_mut() {
            *x *= inv;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn norm(v: &[f32]) -> f32 {
        v.iter().map(|x| x * x).sum::<f32>().sqrt()
    }

    #[test]
    fn zero_vector_stays_zero_without_nan() {
        let mut v = vec![0.0f32; 8];
        normalize_l2(&mut v);
        assert!(v.iter().all(|&x| x == 0.0));
        assert!(v.iter().all(|x| x.is_finite()), "не должно быть NaN/inf");
    }

    #[test]
    fn known_vector_normalized() {
        let mut v = vec![3.0f32, 4.0];
        normalize_l2(&mut v);
        assert!((v[0] - 0.6).abs() < 1e-6);
        assert!((v[1] - 0.8).abs() < 1e-6);
        assert!((norm(&v) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn unit_length_after_normalization() {
        for seed in 0..20u32 {
            let mut v: Vec<f32> = (0..64)
                .map(|i| ((seed * 31 + i * 7) % 13) as f32 - 6.0)
                .collect();
            normalize_l2(&mut v);
            assert!(
                (norm(&v) - 1.0).abs() < 1e-5,
                "после L2-нормы длина должна быть 1 (seed={seed})"
            );
        }
    }

    #[test]
    fn negative_components_handled() {
        let mut v = vec![-3.0f32, 4.0];
        normalize_l2(&mut v);
        assert!((v[0] + 0.6).abs() < 1e-6, "знак сохраняется");
        assert!((v[1] - 0.8).abs() < 1e-6);
    }

    #[test]
    fn empty_slice_is_noop() {
        let mut v: Vec<f32> = Vec::new();
        normalize_l2(&mut v);
        assert!(v.is_empty());
    }

    #[test]
    fn tiny_values_below_epsilon_are_left_alone() {
        // Норма ниже 1e-12 — вектор не трогаем (защита от деления на ноль)
        let tiny = 1e-20f32;
        let mut v = vec![tiny, tiny];
        normalize_l2(&mut v);
        assert_eq!(v, vec![tiny, tiny]);
    }

    // -----------------------------------------------------------------------
    // HTTP-ветки embed_text через локальный mock-сервер
    // -----------------------------------------------------------------------

    type SharedBuf = std::sync::Arc<tokio::sync::Mutex<Vec<u8>>>;

    /// Mock-сервер: отвечает `status`+`body`, захваченные байты запроса
    /// складывает в `captured`. Полностью tokio::net (см. fetch.rs).
    async fn spawn_mock(
        status_line: &'static str,
        body: &'static str,
        captured: SharedBuf,
    ) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            for _ in 0..8 {
                let mut s = match listener.accept().await {
                    Ok((s, _)) => s,
                    Err(_) => break,
                };
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = vec![0u8; 16384];
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
                let content_type = if status_line.starts_with("HTTP/1.1 2") {
                    "application/json"
                } else {
                    "text/plain"
                };
                let response = format!(
                    "{status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = s.write_all(response.as_bytes()).await;
                drop(s);
            }
        });
        format!("http://127.0.0.1:{port}/v1/embeddings")
    }

    fn captured_str(captured: &SharedBuf) -> String {
        String::from_utf8_lossy(&captured.try_lock().unwrap()).into_owned()
    }

    fn ok_body() -> &'static str {
        r#"{"data":[{"embedding":[3.0,4.0]}]}"#
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn http_success_returns_l2_normalized_vector() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), captured.clone()).await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        });
        let vec = svc.embed_query("тест").await.expect("успешный ответ");

        assert_eq!(vec.len(), 2);
        let norm_sq: f32 = vec.iter().map(|x| x * x).sum();
        assert!((norm_sq - 1.0).abs() < 1e-5, "L2-нормализация: {vec:?}");
        assert!(vec[0] > 0.0 && vec[1] > 0.0, "знаки сохранены");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn embed_query_sends_query_prefix_and_model() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), captured.clone()).await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            model: "test-model".into(),
            ..Default::default()
        });
        svc.embed_query("  древний мир  ").await.unwrap();

        let req = captured_str(&captured);
        assert!(req.contains("\"input\":\"query: древний мир\""), "префикс query: + trim: {req}");
        assert!(req.contains("\"model\":\"test-model\""), "модель в теле: {req}");
        assert!(req.to_ascii_lowercase().contains("post /v1/embeddings"), "POST на endpoint");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn embed_passage_sends_passage_prefix() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), captured.clone()).await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        });
        svc.embed_passage("текст главы").await.unwrap();

        let req = captured_str(&captured);
        assert!(req.contains("\"input\":\"passage: текст главы\""), "{req}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn api_key_sent_as_bearer_when_present() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), captured.clone()).await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            api_key: Some("secret-key".into()),
            ..Default::default()
        });
        svc.embed_query("x").await.unwrap();

        assert!(
            captured_str(&captured).contains("authorization: Bearer secret-key"),
            "bearer-заголовок из api_key"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn blank_api_key_is_not_sent() {
        for blank in [None, Some(String::new()), Some("   ".into())] {
            let cap: SharedBuf = Default::default();
            let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), cap.clone()).await;
            let svc = EmbedderService::new(EmbedderConfig {
                endpoint: url,
                api_key: blank,
                ..Default::default()
            });
            svc.embed_query("x").await.unwrap();
            assert!(
                !captured_str(&cap).to_ascii_lowercase().contains("authorization:"),
                "пустой ключ не отправляется"
            );
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn http_error_status_becomes_err_with_status_text() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 500 Internal Server Error", "boom", captured).await;

        let svc = EmbedderService::default();
        svc.update_config(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        })
        .await;
        let err = svc.embed_query("x").await.expect_err("500 → Err");
        assert!(err.contains("500"), "статус в ошибке: {err}");
        assert!(err.contains("boom"), "тело ошибки пробрасывается: {err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn invalid_json_body_is_reported() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", "not-json{{", captured).await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        });
        let err = svc.embed_query("x").await.expect_err("битый JSON → Err");
        assert!(err.contains("Invalid embedding response"), "{err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn missing_embedding_field_is_reported() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock(
            "HTTP/1.1 200 OK",
            r#"{"data":[{"embedding":null}]}"#,
            captured,
        )
        .await;

        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        });
        let err = svc.embed_query("x").await.expect_err("нет вектора → Err");
        assert!(err.contains("Failed to parse embedding vector"), "{err}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn unreachable_endpoint_is_err_not_panic() {
        // Порт 1 — почти наверняка никто не слушает
        let svc = EmbedderService::new(EmbedderConfig {
            endpoint: "http://127.0.0.1:1/v1/embeddings".into(),
            ..Default::default()
        });
        assert!(svc.embed_query("x").await.is_err());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn update_config_switches_endpoint_live() {
        let captured: SharedBuf = Default::default();
        let url = spawn_mock("HTTP/1.1 200 OK", ok_body(), captured.clone()).await;

        let svc = EmbedderService::default();
        svc.update_config(EmbedderConfig {
            endpoint: url,
            ..Default::default()
        })
        .await;
        // Дефолтный endpoint (127.0.0.1:8080) недоступен — успех возможен
        // только если запрос ушёл на новый URL.
        svc.embed_query("y").await.expect("запрос после update_config");
        assert!(!captured_str(&captured).is_empty(), "запрос дошёл до нового endpoint");
    }
}
