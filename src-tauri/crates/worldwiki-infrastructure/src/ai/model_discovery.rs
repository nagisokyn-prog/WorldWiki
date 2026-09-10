//! Model discovery client for remote AI providers and local servers.
//! Queries official `/models` or `/tags` REST endpoints via `reqwest`.

use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;

/// Fetches the live list of models from the provider's API.
pub async fn fetch_provider_models(
    provider: &str,
    api_key: Option<&str>,
) -> Result<Vec<AiModelInfo>, DomainError> {
    let trimmed_key = api_key.map(|k| k.trim()).filter(|k| !k.is_empty());

    let build_client = |timeout_secs: u64| -> Result<reqwest::Client, DomainError> {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::USER_AGENT,
            reqwest::header::HeaderValue::from_static("WorldWiki/0.85.0"),
        );
        reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build()
            .map_err(|e| DomainError::ConstraintViolation(format!("Failed to build HTTP client: {e}")))
    };

    match provider {
        // 1. OPENROUTER
        "openrouter" => {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::USER_AGENT,
                reqwest::header::HeaderValue::from_static("WorldWiki/0.85.0"),
            );
            headers.insert(
                "HTTP-Referer",
                reqwest::header::HeaderValue::from_static("https://worldwiki.app"),
            );
            headers.insert(
                "X-Title",
                reqwest::header::HeaderValue::from_static("WorldWiki"),
            );

            if let Some(key) = trimmed_key {
                if let Ok(val) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key)) {
                    headers.insert(reqwest::header::AUTHORIZATION, val);
                }
            }

            let client = reqwest::Client::builder()
                .default_headers(headers)
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to build HTTP client: {e}")))?;

            let res = client
                .get("https://openrouter.ai/api/v1/models")
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("OpenRouter network request failed: {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("OpenRouter API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct OpenRouterTopProvider {
                max_completion_tokens: Option<u64>,
                context_length: Option<u64>,
            }

            #[derive(serde::Deserialize)]
            struct OpenRouterModelEntry {
                id: String,
                name: Option<String>,
                description: Option<String>,
                context_length: Option<u64>,
                top_provider: Option<OpenRouterTopProvider>,
            }

            #[derive(serde::Deserialize)]
            struct OpenRouterResponse {
                data: Vec<OpenRouterModelEntry>,
            }

            let parsed: OpenRouterResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse OpenRouter JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .data
                .into_iter()
                .map(|m| {
                    let ctx = m.context_length.or_else(|| m.top_provider.as_ref().and_then(|tp| tp.context_length));
                    let max_comp = m.top_provider.as_ref().and_then(|tp| tp.max_completion_tokens);
                    let label = m.name.unwrap_or_else(|| m.id.clone());
                    AiModelInfo {
                        value: m.id,
                        label,
                        description: m.description,
                        context_length: ctx,
                        max_completion_tokens: max_comp,
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        // 2. ANTHROPIC
        "anthropic" => {
            let key = trimmed_key.ok_or_else(|| {
                DomainError::ConstraintViolation("Для загрузки моделей Anthropic укажите API ключ в профиле".into())
            })?;

            let client = build_client(15)?;
            let res = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Anthropic network request failed: {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("Anthropic API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct AnthropicModelEntry {
                id: String,
                display_name: Option<String>,
            }

            #[derive(serde::Deserialize)]
            struct AnthropicResponse {
                data: Vec<AnthropicModelEntry>,
            }

            let parsed: AnthropicResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse Anthropic JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .data
                .into_iter()
                .map(|m| {
                    let label = m.display_name.unwrap_or_else(|| m.id.clone());
                    AiModelInfo {
                        value: m.id,
                        label,
                        description: None,
                        context_length: Some(200_000),
                        max_completion_tokens: Some(8192),
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        // 3. OPENAI
        "openai" => {
            let key = trimmed_key.ok_or_else(|| {
                DomainError::ConstraintViolation("Для загрузки моделей OpenAI укажите API ключ в профиле".into())
            })?;

            let client = build_client(15)?;
            let res = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("OpenAI network request failed: {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("OpenAI API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct OpenAiModelEntry {
                id: String,
            }

            #[derive(serde::Deserialize)]
            struct OpenAiResponse {
                data: Vec<OpenAiModelEntry>,
            }

            let parsed: OpenAiResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse OpenAI JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .data
                .into_iter()
                .filter(|m| {
                    let id = m.id.to_lowercase();
                    id.starts_with("gpt-") || id.starts_with("o1") || id.starts_with("o3") || id.starts_with("o4") || id.starts_with("chatgpt-")
                })
                .map(|m| {
                    AiModelInfo {
                        value: m.id.clone(),
                        label: m.id,
                        description: None,
                        context_length: Some(128_000),
                        max_completion_tokens: Some(4096),
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        // 4. DEEPSEEK
        "deepseek" => {
            let key = trimmed_key.ok_or_else(|| {
                DomainError::ConstraintViolation("Для загрузки моделей DeepSeek укажите API ключ в профиле".into())
            })?;

            let client = build_client(15)?;
            let res = client
                .get("https://api.deepseek.com/models")
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("DeepSeek network request failed: {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("DeepSeek API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct DeepSeekModelEntry {
                id: String,
            }

            #[derive(serde::Deserialize)]
            struct DeepSeekResponse {
                data: Vec<DeepSeekModelEntry>,
            }

            let parsed: DeepSeekResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse DeepSeek JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .data
                .into_iter()
                .map(|m| {
                    let desc = if m.id.contains("reasoner") || m.id.contains("r1") {
                        Some("DeepSeek Reasoning Model".into())
                    } else {
                        Some("DeepSeek Chat Model".into())
                    };
                    AiModelInfo {
                        value: m.id.clone(),
                        label: m.id,
                        description: desc,
                        context_length: Some(64_000),
                        max_completion_tokens: Some(8192),
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        // 5. GOOGLE GEMINI
        "gemini" => {
            let key = trimmed_key.ok_or_else(|| {
                DomainError::ConstraintViolation("Для загрузки моделей Gemini укажите API ключ в профиле".into())
            })?;

            let client = build_client(15)?;
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
            let res = client
                .get(&url)
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Gemini network request failed: {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("Gemini API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct GeminiModelEntry {
                name: String,
                #[serde(rename = "displayName")]
                display_name: Option<String>,
                description: Option<String>,
                #[serde(rename = "inputTokenLimit")]
                input_token_limit: Option<u64>,
                #[serde(rename = "outputTokenLimit")]
                output_token_limit: Option<u64>,
                #[serde(rename = "supportedGenerationMethods")]
                supported_methods: Option<Vec<String>>,
            }

            #[derive(serde::Deserialize)]
            struct GeminiResponse {
                models: Vec<GeminiModelEntry>,
            }

            let parsed: GeminiResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse Gemini JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .models
                .into_iter()
                .filter(|m| {
                    m.supported_methods.as_ref().is_none_or(|methods| {
                        methods.iter().any(|method| method == "generateContent")
                    })
                })
                .map(|m| {
                    let id = m.name.strip_prefix("models/").unwrap_or(&m.name).to_string();
                    let label = m.display_name.unwrap_or_else(|| id.clone());
                    AiModelInfo {
                        value: id,
                        label,
                        description: m.description,
                        context_length: m.input_token_limit,
                        max_completion_tokens: m.output_token_limit,
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        // 6. OLLAMA
        "ollama" => {
            let client = build_client(10)?;
            let res = client
                .get("http://localhost:11434/api/tags")
                .send()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Ollama server connection failed (убедитесь, что Ollama запущена): {e}")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(DomainError::ConstraintViolation(format!("Ollama API error {status}: {text}")));
            }

            #[derive(serde::Deserialize)]
            struct OllamaDetails {
                family: Option<String>,
                parameter_size: Option<String>,
            }

            #[derive(serde::Deserialize)]
            struct OllamaModelEntry {
                name: String,
                details: Option<OllamaDetails>,
            }

            #[derive(serde::Deserialize)]
            struct OllamaResponse {
                models: Vec<OllamaModelEntry>,
            }

            let parsed: OllamaResponse = res
                .json()
                .await
                .map_err(|e| DomainError::ConstraintViolation(format!("Failed to parse Ollama JSON: {e}")))?;

            let mut models: Vec<AiModelInfo> = parsed
                .models
                .into_iter()
                .map(|m| {
                    let desc = m.details.as_ref().map(|d| {
                        format!(
                            "{} {}",
                            d.family.as_deref().unwrap_or(""),
                            d.parameter_size.as_deref().unwrap_or("")
                        ).trim().to_string()
                    }).filter(|s| !s.is_empty());

                    AiModelInfo {
                        value: m.name.clone(),
                        label: m.name,
                        description: desc,
                        context_length: Some(8192),
                        max_completion_tokens: Some(4096),
                    }
                })
                .collect();

            models.sort_by_key(|a| a.label.to_lowercase());
            Ok(models)
        }

        other => Err(DomainError::ConstraintViolation(format!(
            "Провайдер '{other}' не поддерживает автоматическое получение списка моделей через API"
        ))),
    }
}
