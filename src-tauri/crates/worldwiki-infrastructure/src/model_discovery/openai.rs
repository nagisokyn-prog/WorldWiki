use worldwiki_domain::errors::DomainResultExt;
use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;
use super::http::build_client;

#[derive(serde::Deserialize)]
struct OpenAiModelEntry {
    id: String,
}

#[derive(serde::Deserialize)]
struct OpenAiResponse {
    data: Vec<OpenAiModelEntry>,
}

#[derive(serde::Deserialize)]
struct DeepSeekModelEntry {
    id: String,
}

#[derive(serde::Deserialize)]
struct DeepSeekResponse {
    data: Vec<DeepSeekModelEntry>,
}

pub(crate) async fn fetch_openai(trimmed_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError> {
    let key = trimmed_key.ok_or_else(|| {
        DomainError::ConstraintViolation("Для загрузки моделей OpenAI укажите API ключ в профиле".into())
    })?;

    let client = build_client(15)?;
    let res = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .ctx_constraint("OpenAI network request failed")?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(DomainError::ConstraintViolation(format!("OpenAI API error {status}: {text}")));
    }

    let parsed: OpenAiResponse = res
        .json()
        .await
        .ctx_constraint("Failed to parse OpenAI JSON")?;

    let mut models = Vec::new();
    for m in parsed.data {
        let id = m.id.to_lowercase();
        if !(id.starts_with("gpt-")
            || id.starts_with("o1")
            || id.starts_with("o3")
            || id.starts_with("o4")
            || id.starts_with("chatgpt-"))
        {
            continue;
        }
        models.push(AiModelInfo {
            value: m.id.clone(),
            label: m.id,
            description: None,
            context_length: Some(128_000),
            max_completion_tokens: Some(4096),
        });
    }

    models.sort_by_key(|a| a.label.to_lowercase());
    Ok(models)
}

pub(crate) async fn fetch_deepseek(trimmed_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError> {
    let key = trimmed_key.ok_or_else(|| {
        DomainError::ConstraintViolation("Для загрузки моделей DeepSeek укажите API ключ в профиле".into())
    })?;

    let client = build_client(15)?;
    let res = client
        .get("https://api.deepseek.com/models")
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .ctx_constraint("DeepSeek network request failed")?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(DomainError::ConstraintViolation(format!("DeepSeek API error {status}: {text}")));
    }

    let parsed: DeepSeekResponse = res
        .json()
        .await
        .ctx_constraint("Failed to parse DeepSeek JSON")?;

    let mut models = Vec::with_capacity(parsed.data.len());
    for m in parsed.data {
        let desc = if m.id.contains("reasoner") || m.id.contains("r1") {
            Some("DeepSeek Reasoning Model".into())
        } else {
            Some("DeepSeek Chat Model".into())
        };
        models.push(AiModelInfo {
            value: m.id.clone(),
            label: m.id,
            description: desc,
            context_length: Some(64_000),
            max_completion_tokens: Some(8192),
        });
    }

    models.sort_by_key(|a| a.label.to_lowercase());
    Ok(models)
}

