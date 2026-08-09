use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct AiModelInfo {
    pub value: String,
    pub label: String,
    pub description: String,
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
pub async fn fetch_ai_models(provider: String, api_key: Option<String>) -> Result<Vec<AiModelInfo>, String> {
    let client = Client::new();

    match provider.as_str() {
        "openrouter" => {
            let res = client
                .get("https://openrouter.ai/api/v1/models")
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if res.status().is_success() {
                let json: OpenRouterResponse = res.json().await.map_err(|e| e.to_string())?;
                let mut models: Vec<AiModelInfo> = json.data.into_iter().map(|m| AiModelInfo {
                    value: m.id.clone(),
                    label: m.name,
                    description: m.description.unwrap_or_else(|| m.id),
                }).collect();
                
                // Sort by name
                models.sort_by(|a, b| a.label.cmp(&b.label));
                Ok(models)
            } else {
                Err(format!("OpenRouter API error: {}", res.status()))
            }
        },
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
                    let mut models: Vec<AiModelInfo> = json.data.into_iter().map(|m| AiModelInfo {
                        value: m.id.clone(),
                        label: m.id.clone(),
                        description: "OpenAI Model".to_string(),
                    }).collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("OpenAI API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        },
        "gemini" => {
            if let Some(key) = api_key {
                if key.is_empty() {
                    return Ok(vec![]);
                }
                let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
                let res = client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                
                if res.status().is_success() {
                    let json: GeminiResponse = res.json().await.map_err(|e| e.to_string())?;
                    let mut models: Vec<AiModelInfo> = json.models.into_iter().map(|m| AiModelInfo {
                        value: m.name.replace("models/", ""), // Gemini returns "models/gemini-1.5-pro"
                        label: m.display_name.unwrap_or_else(|| m.name.clone()),
                        description: m.description.unwrap_or_else(|| "Gemini Model".to_string()),
                    }).collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("Gemini API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        },
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
                    let mut models: Vec<AiModelInfo> = json.data.into_iter().map(|m| AiModelInfo {
                        value: m.id.clone(),
                        label: m.id.clone(),
                        description: "Anthropic Model".to_string(),
                    }).collect();
                    models.sort_by(|a, b| a.label.cmp(&b.label));
                    Ok(models)
                } else {
                    Err(format!("Anthropic API error: {}", res.status()))
                }
            } else {
                Ok(vec![])
            }
        },
        "local" => {
            // Attempt to fetch from llama.cpp / vllm local server
            let res = client
                .get("http://localhost:8080/v1/models")
                .send()
                .await
                .map_err(|e| e.to_string())?;
                
            if res.status().is_success() {
                let json = res.json::<OpenAiResponse>().await.map_err(|e| e.to_string())?;
                let mut models: Vec<AiModelInfo> = json.data.into_iter().map(|m| AiModelInfo {
                    value: m.id.clone(),
                    label: m.id.clone(),
                    description: "Локальная модель".to_string(),
                }).collect();
                models.sort_by(|a, b| a.label.cmp(&b.label));
                return Ok(models);
            }
            Err(format!("Local API error: {}", res.status()))
        }
        _ => Ok(vec![]),
    }
}

