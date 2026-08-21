use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
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
