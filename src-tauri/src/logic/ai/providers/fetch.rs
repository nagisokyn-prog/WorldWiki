use std::path::PathBuf;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct AiModelInfo {
    pub value: String,
    pub label: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_completion_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OpenRouterModel {
    id: String,
    name: String,
    description: Option<String>,
}

#[derive(Deserialize)]
struct OpenRouterResponse {
    data: Vec<OpenRouterModel>,
}

#[derive(Deserialize)]
struct OpenAiModel {
    id: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    data: Vec<OpenAiModel>,
}

#[derive(Deserialize)]
struct GeminiModel {
    name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    models: Vec<GeminiModel>,
}

#[tauri::command]
pub async fn fetch_ai_models(
    provider: String,
    api_key: Option<String>,
) -> Result<Vec<AiModelInfo>, String> {
    fetch_ai_models_inner(&provider, api_key.as_deref(), None).await
}

/// Ядро получения списка моделей. `base_override` подменяет endpoint каталога
/// моделей (для тестов с локальным mock-сервером); в проде всегда None.
pub(crate) async fn fetch_ai_models_inner(
    provider: &str,
    api_key: Option<&str>,
    base_override: Option<String>,
) -> Result<Vec<AiModelInfo>, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("HTTP-Referer", reqwest::header::HeaderValue::from_static("https://github.com/WorldWiki"));
            headers.insert("X-Title", reqwest::header::HeaderValue::from_static("WorldWiki"));
            headers.insert(reqwest::header::ACCEPT, reqwest::header::HeaderValue::from_static("application/json"));
            headers
        })
        .build()
        .unwrap_or_else(|_| Client::new());

    match provider {
        "openrouter" => {
            let url = base_override.unwrap_or_else(|| "https://openrouter.ai/api/v1/models".to_string());
            let mut req = client.get(url);
            if let Some(key) = &api_key {
                if !key.is_empty() {
                    req = req.bearer_auth(key);
                }
            }
            let res = req.send().await.map_err(|e| e.to_string())?;

            if res.status().is_success() {
                let json: OpenRouterResponse = res.json().await.map_err(|e| e.to_string())?;
                let mut models: Vec<AiModelInfo> = json
                    .data
                    .into_iter()
                    .map(|m| AiModelInfo {
                        value: m.id.clone(),
                        label: m.name,
                        description: m.description.unwrap_or(m.id),
                        context_length: None,
                        max_completion_tokens: None,
                    })
                    .collect();

                // Sort by name
                models.sort_by(|a, b| a.label.cmp(&b.label));
                Ok(models)
            } else {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                Err(format!("OpenRouter API error: {} - {}", status, text))
            }
        }
        "openai" => {
            if let Some(key) = api_key {
                if key.is_empty() {
                    return Ok(vec![]);
                }
                let res = client
                    .get(base_override.unwrap_or_else(|| "https://api.openai.com/v1/models".to_string()))
                    .bearer_auth(key)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                if res.status().is_success() {
                    let json: OpenAiResponse = res.json().await.map_err(|e| e.to_string())?;
                    let mut models: Vec<AiModelInfo> = json
                        .data
                        .into_iter()
                        .map(|m| AiModelInfo {
                            value: m.id.clone(),
                            label: m.id.clone(),
                            description: "OpenAI Model".to_string(),
                            context_length: None,
                            max_completion_tokens: None,
                        })
                        .collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("OpenAI API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        }
        "gemini" => {
            if let Some(key) = api_key {
                if key.is_empty() {
                    return Ok(vec![]);
                }
                let base = base_override.unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1beta/models".to_string());
                let url = format!(
                    "{}?key={}",
                    base,
                    key
                );
                let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

                if res.status().is_success() {
                    let json: GeminiResponse = res.json().await.map_err(|e| e.to_string())?;
                    let mut models: Vec<AiModelInfo> = json
                        .models
                        .into_iter()
                        .map(|m| AiModelInfo {
                            value: m.name.replace("models/", ""), // Gemini returns "models/gemini-1.5-pro"
                            label: m.name.clone(),
                            description: m.description.unwrap_or_else(|| m.display_name.unwrap_or_else(|| m.name.clone())),
                            context_length: None,
                            max_completion_tokens: None,
                        })
                        .collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("Gemini API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        }
        "anthropic" => {
            if let Some(key) = api_key {
                if key.is_empty() {
                    return Ok(vec![]);
                }
                let res = client
                    .get(base_override.unwrap_or_else(|| "https://api.anthropic.com/v1/models".to_string()))
                    .header("x-api-key", key)
                    .header("anthropic-version", "2023-06-01")
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                if res.status().is_success() {
                    let json: OpenAiResponse = res.json().await.map_err(|e| e.to_string())?; // Their schema is similar to openai's basic schema
                    let mut models: Vec<AiModelInfo> = json
                        .data
                        .into_iter()
                        .map(|m| AiModelInfo {
                            value: m.id.clone(),
                            label: m.id.clone(),
                            description: "Anthropic Model".to_string(),
                            context_length: None,
                            max_completion_tokens: None,
                        })
                        .collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("Anthropic API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        }
        "local" => {
            let mut models: Vec<AiModelInfo> = Vec::new();

            // Scan AppData/WorldWiki/models and ./models directories
            let mut candidate_dirs = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidate_dirs.push(PathBuf::from(&local_app_data).join("WorldWiki").join("models"));
                candidate_dirs.push(PathBuf::from(&local_app_data).join("world-wiki").join("models"));
            }
            if let Ok(app_data) = std::env::var("APPDATA") {
                candidate_dirs.push(PathBuf::from(&app_data).join("WorldWiki").join("models"));
                candidate_dirs.push(PathBuf::from(&app_data).join("world-wiki").join("models"));
            }
            candidate_dirs.push(PathBuf::from("./models"));
            candidate_dirs.push(PathBuf::from("../models"));

            for dir in candidate_dirs {
                if dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) == Some("gguf".to_string()) {
                                let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("model.gguf");
                                let path_str = path.to_string_lossy().to_string();
                                if !models.iter().any(|m| m.value == path_str) {
                                    models.push(AiModelInfo {
                                        value: path_str,
                                        label: filename.to_string(),
                                        description: "Local GGUF Model (llama-turboquant-cpp)".to_string(),
                                        context_length: Some(8192),
                                        max_completion_tokens: None,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Fallback check for local OpenAI-compatible server (e.g. llama-server or vLLM)
            if let Ok(res) = client.get("http://localhost:8080/v1/models").send().await {
                if res.status().is_success() {
                    if let Ok(json) = res.json::<OpenAiResponse>().await {
                        for m in json.data {
                            if !models.iter().any(|existing| existing.value == m.id) {
                                models.push(AiModelInfo {
                                    value: m.id.clone(),
                                    label: format!("{} (Server :8080)", m.id),
                                    description: "Local Server Model".to_string(),
                                    context_length: None,
                                    max_completion_tokens: None,
                                });
                            }
                        }
                    }
                }
            }

            models.sort_by(|a, b| a.label.cmp(&b.label));
            Ok(models)
        }
        _ => Ok(vec![]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Асинхронный mock-сервер: отвечает одним JSON на любой запрос.
    /// Полностью tokio::net — блокирующий std::net вешает shutdown рантайма.
    async fn spawn_mock_json(body: &'static str) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            for _ in 0..5 {
                let mut s = match listener.accept().await {
                    Ok((s, _)) => s,
                    Err(_) => break,
                };
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = [0u8; 8192];
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
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = s.write_all(response.as_bytes()).await;
                drop(s);
            }
        });
        format!("http://127.0.0.1:{port}/models")
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn openrouter_models_parsed_and_sorted() {
        let url = spawn_mock_json(
            r#"{"data":[
                {"id":"z/model","name":"Zeta","description":"last"},
                {"id":"a/model","name":"Alpha","description":null}
            ]}"#,
        )
        .await;
        let models = fetch_ai_models_inner("openrouter", Some("key"), Some(url))
            .await
            .unwrap();
        assert_eq!(models.len(), 2);
        // сортировка по label
        assert_eq!(models[0].label, "Alpha");
        assert_eq!(models[1].label, "Zeta");
        assert_eq!(models[0].value, "a/model");
        assert_eq!(models[1].description, "last");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn openai_models_parsed() {
        let url = spawn_mock_json(r#"{"data":[{"id":"gpt-x"},{"id":"gpt-a"}]}"#).await;
        let models = fetch_ai_models_inner("openai", Some("sk-key"), Some(url))
            .await
            .unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].value, "gpt-a");
        assert_eq!(models[0].description, "OpenAI Model");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn gemini_display_name_and_prefix_stripped() {
        let url = spawn_mock_json(
            r#"{"models":[
                {"name":"models/gemini-1.5-pro","displayName":"Gemini 1.5 Pro","description":"desc"}
            ]}"#,
        )
        .await;
        let models = fetch_ai_models_inner("gemini", Some("g-key"), Some(url))
            .await
            .unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].value, "gemini-1.5-pro", "префикс models/ снимается");
        assert_eq!(models[0].description, "desc", "description приоритетнее displayName");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn anthropic_openai_like_schema_parsed() {
        let url = spawn_mock_json(r#"{"data":[{"id":"claude-x"}]}"#).await;
        let models = fetch_ai_models_inner("anthropic", Some("ak-key"), Some(url))
            .await
            .unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].value, "claude-x");
        assert_eq!(models[0].description, "Anthropic Model");
    }

    #[tokio::test]
    async fn empty_or_missing_keys_short_circuit_to_empty_vec() {
        for provider in ["openai", "gemini", "anthropic"] {
            let none = fetch_ai_models_inner(provider, None, None).await.unwrap();
            assert!(none.is_empty(), "{provider}: None key → []");
            let empty = fetch_ai_models_inner(provider, Some(""), None)
                .await
                .unwrap();
            assert!(empty.is_empty(), "{provider}: пустой key → []");
        }
    }

    #[tokio::test]
    async fn unknown_provider_returns_empty_ok() {
        let models = fetch_ai_models_inner("hal9000", Some("k"), None).await.unwrap();
        assert!(models.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn local_branch_scans_gguf_from_env_dirs_without_dedup() {
        // Подменяем APPDATA/LOCALAPPDATA на temp и кладём .gguf файлы
        let tmp = std::env::temp_dir().join(format!("ww_fetch_{}", uuid::Uuid::new_v4()));
        let dir = tmp.join("WorldWiki").join("models");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("b-model.gguf"), b"fake").unwrap();
        std::fs::write(dir.join("a-model.GGUF"), b"fake").unwrap();
        std::fs::write(dir.join("ignored.txt"), b"nope").unwrap();

        std::env::set_var("APPDATA", &tmp);
        std::env::set_var("LOCALAPPDATA", &tmp);

        let models = fetch_ai_models_inner("local", None, None).await.unwrap();
        let _ = std::fs::remove_dir_all(&tmp);

        let labels: Vec<&str> = models.iter().map(|m| m.label.as_str()).collect();
        assert_eq!(labels.len(), 2, "только .gguf (любой регистр), txt игнорится: {labels:?}");
        assert!(labels.contains(&"a-model.GGUF"));
        assert!(labels.contains(&"b-model.gguf"));
        // сортировка по label
        assert_eq!(labels[0], "a-model.GGUF");
        // дедупликация по value не порождает дублей при повторном скане каталогов
        let values: std::collections::HashSet<_> = models.iter().map(|m| &m.value).collect();
        assert_eq!(values.len(), models.len());
    }
}
