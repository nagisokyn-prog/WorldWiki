use worldwiki_domain::errors::DomainResultExt;
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
        .ctx_constraint("Failed to build HTTP client")?;

    let res = client
        .get("https://openrouter.ai/api/v1/models")
        .send()
        .await
        .ctx_constraint("OpenRouter network request failed")?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(DomainError::ConstraintViolation(format!("OpenRouter API error {status}: {text}")));
    }

    let parsed: OpenRouterResponse = res
        .json()
        .await
        .ctx_constraint("Failed to parse OpenRouter JSON")?;

    let mut models = Vec::with_capacity(parsed.data.len());
    for m in parsed.data {
        let ctx = match m.context_length {
            Some(c) => Some(c),
            None => m.top_provider.as_ref().and_then(|tp| tp.context_length),
        };
        let max_comp = m.top_provider.as_ref().and_then(|tp| tp.max_completion_tokens);
        let label = match m.name {
            Some(name) => name,
            None => m.id.clone(),
        };
        models.push(AiModelInfo {
            value: m.id,
            label,
            description: m.description,
            context_length: ctx,
            max_completion_tokens: max_comp,
        });
    }

    models.sort_by_key(|a| a.label.to_lowercase());
    Ok(models)
}

