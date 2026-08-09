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
                        description: m.description.unwrap_or_else(|| m.id),
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
                            description: m.display_name.unwrap_or_else(|| m.name.clone()),
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
            // Attempt to fetch from llama.cpp / vllm local server
            let res = client
                .get("http://localhost:8080/v1/models")
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if res.status().is_success() {
                let json = res
                    .json::<OpenAiResponse>()
                    .await
                    .map_err(|e| e.to_string())?;
                let mut models: Vec<AiModelInfo> = json
                    .data
                    .into_iter()
                    .map(|m| AiModelInfo {
                        value: m.id.clone(),
                        label: m.id.clone(),
                        description: "Local / OpenAI Compatible Model".to_string(),
                        context_length: None,
                        max_completion_tokens: None,
                    })
                    .collect();
                models.sort_by(|a, b| a.label.cmp(&b.label));
                return Ok(models);
            }
            Err(format!("Local API error: {}", res.status()))
        }
        _ => Ok(vec![]),
    }
}
