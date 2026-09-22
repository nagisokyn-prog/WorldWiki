use worldwiki_domain::DomainError;

pub(crate) fn build_client(timeout_secs: u64) -> Result<reqwest::Client, DomainError> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("WorldWiki/0.85.0"),
    );
    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| DomainError::ConstraintViolation(format!("Failed to build HTTP client: {e}")))
}
