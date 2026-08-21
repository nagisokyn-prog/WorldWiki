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

    match provider.as_str() {
        "openrouter" => {
            let mut req = client.get("https://openrouter.ai/api/v1/models");
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
                    .get("https://api.openai.com/v1/models")
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
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models?key={}",
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
                    .get("https://api.anthropic.com/v1/models")
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
