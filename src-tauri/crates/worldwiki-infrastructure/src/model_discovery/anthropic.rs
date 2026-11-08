use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;
use super::http::build_client;

#[derive(serde::Deserialize)]
struct AnthropicModelEntry {
    id: String,
    display_name: Option<String>,
}

#[derive(serde::Deserialize)]
struct AnthropicResponse {
    data: Vec<AnthropicModelEntry>,
}

pub(crate) async fn fetch_anthropic(trimmed_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError> {
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

