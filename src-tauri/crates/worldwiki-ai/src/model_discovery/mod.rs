//! Model discovery client for remote AI providers and local servers.
//! Queries official `/models` or `/tags` REST endpoints via `reqwest`.

pub mod anthropic;
pub mod gemini;
pub mod http;
pub mod ollama;
pub mod openai;
pub mod openrouter;

use worldwiki_domain::ai::AiModelInfo;
use worldwiki_domain::DomainError;

/// Fetches the live list of models from the provider's API.
pub async fn fetch_provider_models(
    provider: &str,
    api_key: Option<&str>,
) -> Result<Vec<AiModelInfo>, DomainError> {
    let trimmed_key = api_key.map(|k| k.trim()).filter(|k| !k.is_empty());

    match provider {
        "openrouter" => openrouter::fetch_openrouter(trimmed_key).await,
        "anthropic" => anthropic::fetch_anthropic(trimmed_key).await,
        "openai" => openai::fetch_openai(trimmed_key).await,
        "deepseek" => openai::fetch_deepseek(trimmed_key).await,
        "gemini" => gemini::fetch_gemini(trimmed_key).await,
        "ollama" => ollama::fetch_ollama().await,
        other => Err(DomainError::ConstraintViolation(format!(
            "Провайдер '{other}' не поддерживает автоматическое получение списка моделей через API"
        ))),
    }
}
