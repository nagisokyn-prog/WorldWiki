pub const YANDEX_CLIENT_ID: &str = "200295d252b44387a21ec64a80d7d124";
pub const YANDEX_CLIENT_SECRET: &str = "2c1d8dd57f5e4271a74249f6c4b58895";

/// Базовый URL OAuth-эндпоинта; `base_override` подменяет его в тестах.
pub(crate) fn oauth_base(base_override: Option<&str>) -> String {
    base_override.unwrap_or("https://oauth.yandex.ru").to_string()
}

/// Обмен authorization code на access token.
pub async fn exchange_yandex_token_inner(
    code: &str,
    base_override: Option<&str>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", YANDEX_CLIENT_ID),
        ("client_secret", YANDEX_CLIENT_SECRET),
    ];

    let res = client
        .post(format!("{}/token", oauth_base(base_override)))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let json: serde_json::Value = res.json().await.map_err(|e| format!("JSON error: {e}"))?;

    if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
        Ok(token.to_string())
    } else {
        let err_desc = json
            .get("error_description")
            .or_else(|| json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("Invalid confirmation code");
        Err(err_desc.to_string())
    }
}
