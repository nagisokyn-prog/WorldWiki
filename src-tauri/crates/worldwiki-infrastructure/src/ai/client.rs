//! Provider client construction for LLM providers (Anthropic, OpenAI, Gemini, OpenRouter, DeepSeek).

#[cfg(feature = "ai-cloud")]
use claw_api::{AnthropicClient, AuthSource, OpenAiCompatClient, OpenAiCompatConfig, ProviderClient};

#[cfg(feature = "ai-cloud")]
pub fn build_provider_client(
    provider: &str,
    api_key: &str,
    base_url: Option<String>,
) -> Result<ProviderClient, String> {
    let api_key = api_key.trim().to_string();

    let base_url = base_url.and_then(|s| {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            None
        } else if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            Some(format!("https://{}", trimmed))
        } else {
            Some(trimmed.to_string())
        }
    });

    let mut headers = reqwest::header::HeaderMap::new();
    if provider == "openrouter" {
        headers.insert(
            "HTTP-Referer",
            reqwest::header::HeaderValue::from_static("https://worldwiki.app"),
        );
        headers.insert(
            "X-Title",
            reqwest::header::HeaderValue::from_static("WorldWiki"),
        );
    }

    let http_client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    match provider {
        "anthropic" => {
            let client = AnthropicClient::from_auth(AuthSource::ApiKey(api_key))
                .with_base_url(base_url.unwrap_or_else(|| "https://api.anthropic.com".to_string()));
            Ok(ProviderClient::Anthropic(client))
        }
        "openai" | "openrouter" | "gemini" | "local" | "ollama" | "deepseek" => {
            let default_url = match provider {
                "openai" => "https://api.openai.com/v1",
                "openrouter" => "https://openrouter.ai/api/v1",
                "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai",
                "deepseek" => "https://api.deepseek.com/v1",
                _ => "http://localhost:8080/v1",
            };
            let resolved = base_url.unwrap_or_else(|| default_url.to_string());
            let client = OpenAiCompatClient::new(api_key, OpenAiCompatConfig::openai())
                .with_base_url(resolved)
                .with_http_client(http_client);
            Ok(ProviderClient::OpenAi(client))
        }
        other => Err(format!("unsupported provider: {other}")),
    }
}

#[cfg(test)]
#[cfg(feature = "ai-cloud")]
mod provider_client_tests {
    use super::*;

    #[test]
    fn anthropic_provider_builds() {
        let c = build_provider_client("anthropic", " sk-test ", None);
        assert!(c.is_ok());
        assert!(matches!(c.unwrap(), ProviderClient::Anthropic(_)));
    }

    #[test]
    fn openai_family_providers_build() {
        for p in ["openai", "openrouter", "gemini", "local", "ollama", "deepseek"] {
            let c = build_provider_client(p, "key", None);
            assert!(c.is_ok(), "{p} должен собираться");
            assert!(matches!(c.unwrap(), ProviderClient::OpenAi(_)));
        }
    }

    #[test]
    fn unsupported_provider_errs() {
        let res = build_provider_client("hal9000", "key", None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("unsupported provider"));
    }

    #[test]
    fn base_url_gets_https_prefix_when_scheme_missing() {
        assert!(build_provider_client("openai", "key", Some("my-proxy.example".into())).is_ok());
        assert!(build_provider_client("openai", "key", Some("http://localhost:1234/v1".into())).is_ok());
        assert!(build_provider_client("openai", "key", Some("   ".into())).is_ok());
    }
}
