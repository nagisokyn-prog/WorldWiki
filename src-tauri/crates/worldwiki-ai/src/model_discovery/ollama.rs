use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;
use super::http::build_client;

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

pub(crate) async fn fetch_ollama() -> Result<Vec<AiModelInfo>, DomainError> {
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
