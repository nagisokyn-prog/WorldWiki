//! Canonical URL normalization, query sanitization, and redirect resolution.

use std::collections::HashSet;
use super::html_parser::decode_html_entities;

/// Normalizes a raw URL into canonical format:
/// - Enforces HTTPS scheme for public domains
/// - Strips fragments (#hash)
/// - Strips tracking query parameters (utm_*, ref, yclid, fbclid, gclid, source)
/// - Normalizes trailing slashes
pub fn normalize_canonical_url(raw_url: &str) -> String {
    let Ok(mut parsed) = reqwest::Url::parse(raw_url) else {
        return raw_url.trim().to_string();
    };

    if parsed.scheme() == "http" {
        let host = parsed.host_str().unwrap_or_default();
        if host != "localhost" && host != "127.0.0.1" && host != "::1" {
            let _ = parsed.set_scheme("https");
        }
    }

    parsed.set_fragment(None);

    let filtered_pairs: Vec<(String, String)> = parsed
        .query_pairs()
        .filter(|(k, _)| {
            let lower = k.to_ascii_lowercase();
            !lower.starts_with("utm_")
                && lower != "fbclid"
                && lower != "gclid"
                && lower != "yclid"
                && lower != "ref"
                && lower != "source"
        })
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    if filtered_pairs.is_empty() {
        parsed.set_query(None);
    } else {
        parsed
            .query_pairs_mut()
            .clear()
            .extend_pairs(filtered_pairs);
    }

    let mut out = parsed.to_string();
    if out.ends_with('/') && parsed.path() == "/" {
        // Keep root slash
    } else if out.ends_with('/') {
        out.pop();
    }
    out
}

/// Resolves and decodes DuckDuckGo redirect intermediate URLs.
pub fn decode_duckduckgo_redirect(url: &str) -> Option<String> {
    let decoded = decode_html_entities(url);
    let parsed = if decoded.starts_with("http://") || decoded.starts_with("https://") {
        reqwest::Url::parse(&decoded).ok()
    } else if decoded.starts_with("//") {
        reqwest::Url::parse(&format!("https:{decoded}")).ok()
    } else if decoded.starts_with('/') {
        reqwest::Url::parse(&format!("https://duckduckgo.com{decoded}")).ok()
    } else {
        return None;
    }?;

    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    if (host == "duckduckgo.com" || host.ends_with(".duckduckgo.com"))
        && (parsed.path() == "/l/" || parsed.path() == "/l")
    {
        for (key, value) in parsed.query_pairs() {
            if key == "uddg" {
                return Some(decode_html_entities(value.as_ref()));
            }
        }
    }

    if decoded.starts_with("http://") || decoded.starts_with("https://") {
        Some(decoded)
    } else {
        Some(parsed.to_string())
    }
}

/// Deduplicates search hit URLs based on their canonical form.
pub fn dedupe_hits<T, F>(hits: &mut Vec<T>, url_extractor: F)
where
    F: Fn(&T) -> &str,
{
    let mut seen = HashSet::new();
    hits.retain(|hit| {
        let canonical = normalize_canonical_url(url_extractor(hit));
        seen.insert(canonical)
    });
}
