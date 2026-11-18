use worldwiki_domain::errors::DomainResultExt;
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
        .ctx_constraint("Anthropic network request failed")?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(DomainError::ConstraintViolation(format!("Anthropic API error {status}: {text}")));
    }

    let parsed: AnthropicResponse = res
        .json()
        .await
        .ctx_constraint("Failed to parse Anthropic JSON")?;

    let mut models = Vec::with_capacity(parsed.data.len());
    for m in parsed.data {
        let label = match m.display_name {
            Some(name) => name,
            None => m.id.clone(),
        };
        models.push(AiModelInfo {
            value: m.id,
            label,
            description: None,
            context_length: Some(200_000),
            max_completion_tokens: Some(8192),
        });
    }

    models.sort_by_key(|a| a.label.to_lowercase());
    Ok(models)
}

