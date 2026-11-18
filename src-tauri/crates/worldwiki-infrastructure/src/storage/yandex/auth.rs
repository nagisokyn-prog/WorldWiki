use worldwiki_domain::errors::DomainError;
use worldwiki_domain::errors::DomainResultExt;

pub const YANDEX_CLIENT_ID: &str = "200295d252b44387a21ec64a80d7d124";

/// Базовый URL OAuth-эндпоинта; `base_override` подменяет его в тестах.
pub(crate) fn oauth_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://oauth.yandex.ru").to_string()
}

/// Обмен authorization code на access token (OAuth 2.0 + PKCE).
pub async fn exchange_yandex_token_inner(
    code: &str,
    code_verifier: &str,
    base_override: Option<&str>,
) -> Result<String, DomainError> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", YANDEX_CLIENT_ID),
        ("code_verifier", code_verifier),
    ];

    let res = client
        .post(format!("{}/token", oauth_base(base_override)))
        .form(&params)
        .send()
        .await
        .ctx_validation("Network error")?;

    let json: serde_json::Value = res.json().await.ctx_validation("JSON error")?;

    if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
        Ok(token.to_string())
    } else {
        let err_desc = json
            .get("error_description")
            .or(json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("Invalid confirmation code");
        Err(DomainError::Validation(err_desc.to_string()))
    }
}
