//! Web Scraping and Search Engine Port implementation for WorldWiki research agent.

pub mod duckduckgo;
pub mod hashing;
pub mod html_parser;
pub mod url_utils;

pub use duckduckgo::{DuckDuckGoParser, SearchHit};
pub use hashing::ScraperHashing;
pub use html_parser::{collapse_whitespace, decode_html_entities, extract_quoted_value, extract_title, html_to_text};
pub use url_utils::{decode_duckduckgo_redirect, dedupe_hits, normalize_canonical_url};

use async_trait::async_trait;
use reqwest::Client;
use std::time::Duration;
use worldwiki_domain::ai::{WebEvidence, WebPageEntity};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{SearchHitDto, WebResearchPort};

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

    pub fn normalize_canonical_url(raw_url: &str) -> String {
        url_utils::normalize_canonical_url(raw_url)
    }

    pub fn compute_content_hash(content: &str) -> String {
        ScraperHashing::compute_content_hash(content)
    }

    pub fn compute_simhash(text: &str) -> String {
        ScraperHashing::compute_simhash(text)
    }

    pub fn extract_evidence_chunks(
        page: &WebPageEntity,
        page_id: &str,
        project_id: &str,
    ) -> Vec<WebEvidence> {
        ScraperHashing::extract_evidence_chunks(page, page_id, project_id)
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
        let mut hits = DuckDuckGoParser::extract_search_hits(&html);

        if hits.is_empty() {
            hits = DuckDuckGoParser::extract_search_hits_from_generic_links(&html);
        }

        dedupe_hits(&mut hits, |h| &h.url);
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
