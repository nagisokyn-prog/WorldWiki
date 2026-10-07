use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;

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

pub(crate) async fn fetch_openrouter(trimmed_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError> {
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

    if let Some(key) = trimmed_key
        && let Ok(val) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key)) {
            headers.insert(reqwest::header::AUTHORIZATION, val);
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
