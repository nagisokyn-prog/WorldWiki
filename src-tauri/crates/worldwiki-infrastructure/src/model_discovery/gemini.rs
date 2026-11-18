use worldwiki_domain::errors::DomainResultExt;
use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;
use super::http::build_client;

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

pub(crate) async fn fetch_gemini(trimmed_key: Option<&str>) -> Result<Vec<AiModelInfo>, DomainError> {
    let key = trimmed_key.ok_or_else(|| {
        DomainError::ConstraintViolation("Для загрузки моделей Gemini укажите API ключ в профиле".into())
    })?;

    let client = build_client(15)?;
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
    let res = client
        .get(&url)
        .send()
        .await
        .ctx_constraint("Gemini network request failed")?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(DomainError::ConstraintViolation(format!("Gemini API error {status}: {text}")));
    }

    let parsed: GeminiResponse = res
        .json()
        .await
        .ctx_constraint("Failed to parse Gemini JSON")?;

    let mut models = Vec::with_capacity(parsed.models.len());
    for m in parsed.models {
        if let Some(methods) = m.supported_methods.as_ref()
            && !methods.iter().any(|method| method == "generateContent")
        {
            continue;
        }
        let id = m.name.strip_prefix("models/").unwrap_or(&m.name).to_string();
        let label = match m.display_name {
            Some(name) => name,
            None => id.clone(),
        };
        models.push(AiModelInfo {
            value: id,
            label,
            description: m.description,
            context_length: m.input_token_limit,
            max_completion_tokens: m.output_token_limit,
        });
    }

    models.sort_by_key(|a| a.label.to_lowercase());
    Ok(models)
}

