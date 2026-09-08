use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;
use worldwiki_domain::ai::{WebEvidence, WebPageEntity};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{SearchHitDto, WebResearchPort};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone)]
pub struct WebScraper {
    client: Client,
}

impl Default for WebScraper {
    fn default() -> Self {
        Self::new()
    }
}

impl WebScraper {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::limited(10))
            .user_agent("WorldWiki-Studio/1.0 (Literary Research Engine)")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Нормализация URL: удаление трекинговых параметров (utm_*, ref, yclid, fbclid) и хэша
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

        // Фильтрация query-параметров
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

    /// Вычисление простого SHA256-хэша контента (без тяжелых внешних крейтов через std hasher)
    pub fn compute_content_hash(content: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Вычисление 64-битного SimHash для дедупликации близких источников
    pub fn compute_simhash(text: &str) -> String {
        let mut v = [0i32; 64];
        for word in text.split_whitespace() {
            let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
            if clean.is_empty() {
                continue;
            }
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            clean.to_lowercase().hash(&mut hasher);
            let h = hasher.finish();
            for (i, val) in v.iter_mut().enumerate() {
                let bit = (h >> i) & 1;
                if bit == 1 {
                    *val += 1;
                } else {
                    *val -= 1;
                }
            }
        }
        let mut fingerprint = 0u64;
        for (i, val) in v.iter().enumerate() {
            if *val > 0 {
                fingerprint |= 1 << i;
            }
        }
        format!("{:016x}", fingerprint)
    }

    /// Извлечение атомарных чанков доказательств (Evidence Chunks)
    pub fn extract_evidence_chunks(
        page: &WebPageEntity,
        page_id: &str,
        project_id: &str,
    ) -> Vec<WebEvidence> {
        let mut chunks = Vec::new();
        let mut offset = 0;
        let mut index = 0;

        for paragraph in page.content.split("\n\n") {
            let trimmed = paragraph.trim();
            if trimmed.len() < 40 {
                offset += paragraph.len() + 2;
                continue;
            }

            let simhash = Some(Self::compute_simhash(trimmed));
            chunks.push(WebEvidence {
                id: None,
                page_id: page_id.to_string(),
                project_id: project_id.to_string(),
                chunk_index: index,
                text: trimmed.to_string(),
                start_offset: offset,
                end_offset: offset + trimmed.len(),
                simhash,
                metadata: None,
                created_at: None,
            });

            index += 1;
            offset += paragraph.len() + 2;
        }

        chunks
    }
}

#[async_trait]
impl WebResearchPort for WebScraper {
    async fn search_duckduckgo(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<SearchHitDto>, DomainError> {
        let mut url = reqwest::Url::parse("https://html.duckduckgo.com/html/")
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        url.query_pairs_mut().append_pair("q", query);

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let html = response
            .text()
            .await
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let mut hits = extract_search_hits(&html);

        if hits.is_empty() {
            hits = extract_search_hits_from_generic_links(&html);
        }

        dedupe_hits(&mut hits);
        hits.truncate(limit);

        Ok(hits
            .into_iter()
            .map(|h| SearchHitDto {
                title: h.title,
                url: h.url,
            })
            .collect())
    }

    async fn fetch_page(&self, raw_url: &str) -> Result<WebPageEntity, DomainError> {
        let canonical_url = Self::normalize_canonical_url(raw_url);
        let parsed = reqwest::Url::parse(&canonical_url)
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let domain = parsed.host_str().unwrap_or("unknown").to_string();

        let response = self
            .client
            .get(&canonical_url)
            .send()
            .await
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let status_code = response.status().as_u16() as i32;

        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("text/html")
            .to_string();

        let raw_body = response
            .text()
            .await
            .map_err(|e| DomainError::Validation(e.to_string()))?;
        let title = extract_title(&raw_body, &content_type);
        let clean_text = if content_type.contains("html") {
            html_to_text(&raw_body)
        } else {
            raw_body.trim().to_string()
        };

        let content_hash = Self::compute_content_hash(&clean_text);
        let extracted_markdown = format!(
            "# {}\n\n{}",
            title.clone().unwrap_or_else(|| domain.clone()),
            clean_text
        );

        Ok(WebPageEntity {
            id: None,
            url: raw_url.to_string(),
            canonical_url,
            domain,
            title,
            content_type,
            charset: "utf-8".to_string(),
            language: Some("ru".to_string()),
            content_hash,
            content: clean_text,
            extracted_markdown: Some(extracted_markdown),
            status_code,
            hit_count: 1,
            fetched_at: None,
            expires_at: None,
        })
    }
}

// ---------------------------------------------------------
// Helper Parsing Functions
// ---------------------------------------------------------

fn html_to_text(html: &str) -> String {
    let mut text = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut previous_was_space = false;

    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if in_tag => {}
            '&' => {
                text.push('&');
                previous_was_space = false;
            }
            ch if ch.is_whitespace() => {
                if !previous_was_space {
                    text.push(' ');
                    previous_was_space = true;
                }
            }
            _ => {
                text.push(ch);
                previous_was_space = false;
            }
        }
    }

    collapse_whitespace(&decode_html_entities(&text))
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn collapse_whitespace(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_title(raw_body: &str, content_type: &str) -> Option<String> {
    if content_type.contains("html") {
        let lowered = raw_body.to_lowercase();
        if let Some(start) = lowered.find("<title>") {
            let after = start + "<title>".len();
            if let Some(end_rel) = lowered[after..].find("</title>") {
                let title =
                    collapse_whitespace(&decode_html_entities(&raw_body[after..after + end_rel]));
                if !title.is_empty() {
                    return Some(title);
                }
            }
        }
    }
    None
}

fn extract_search_hits(html: &str) -> Vec<SearchHit> {
    let mut hits = Vec::new();
    let mut remaining = html;

    while let Some(anchor_start) = remaining.find("result__a") {
        let after_class = &remaining[anchor_start..];
        let Some(href_idx) = after_class.find("href=") else {
            remaining = &after_class[1..];
            continue;
        };
        let href_slice = &after_class[href_idx + 5..];
        let Some((url, rest)) = extract_quoted_value(href_slice) else {
            remaining = &after_class[1..];
            continue;
        };
        let Some(close_tag_idx) = rest.find('>') else {
            remaining = &after_class[1..];
            continue;
        };
        let after_tag = &rest[close_tag_idx + 1..];
        let Some(end_anchor_idx) = after_tag.find("</a>") else {
            remaining = &after_tag[1..];
            continue;
        };
        let title = html_to_text(&after_tag[..end_anchor_idx]);
        if let Some(decoded_url) = decode_duckduckgo_redirect(&url) {
            hits.push(SearchHit {
                title: title.trim().to_string(),
                url: decoded_url,
            });
        }
        remaining = &after_tag[end_anchor_idx + 4..];
    }

    hits
}

fn extract_search_hits_from_generic_links(html: &str) -> Vec<SearchHit> {
    let mut hits = Vec::new();
    let mut remaining = html;

    while let Some(anchor_start) = remaining.find("<a") {
        let after_anchor = &remaining[anchor_start..];
        let Some(href_idx) = after_anchor.find("href=") else {
            remaining = &after_anchor[2..];
            continue;
        };
        let href_slice = &after_anchor[href_idx + 5..];
        let Some((url, rest)) = extract_quoted_value(href_slice) else {
            remaining = &after_anchor[2..];
            continue;
        };
        let Some(close_tag_idx) = rest.find('>') else {
            remaining = &after_anchor[2..];
            continue;
        };
        let after_tag = &rest[close_tag_idx + 1..];
        let Some(end_anchor_idx) = after_tag.find("</a>") else {
            remaining = &after_tag[2..];
            continue;
        };
        let title = html_to_text(&after_tag[..end_anchor_idx]);
        if title.trim().is_empty() {
            remaining = &after_tag[end_anchor_idx + 4..];
            continue;
        }
        let decoded_url = decode_duckduckgo_redirect(&url).unwrap_or(url);
        if decoded_url.starts_with("http://") || decoded_url.starts_with("https://") {
            hits.push(SearchHit {
                title: title.trim().to_string(),
                url: decoded_url,
            });
        }
        remaining = &after_tag[end_anchor_idx + 4..];
    }

    hits
}

fn extract_quoted_value(input: &str) -> Option<(String, &str)> {
    let quote = input.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let rest = &input[quote.len_utf8()..];
    let end = rest.find(quote)?;
    Some((rest[..end].to_string(), &rest[end + quote.len_utf8()..]))
}

fn decode_duckduckgo_redirect(url: &str) -> Option<String> {
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

fn dedupe_hits(hits: &mut Vec<SearchHit>) {
    let mut seen = HashSet::new();
    hits.retain(|hit| {
        let canonical = WebScraper::normalize_canonical_url(&hit.url);
        seen.insert(canonical)
    });
}
