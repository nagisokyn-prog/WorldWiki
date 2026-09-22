//! DuckDuckGo HTML search results parser and generic link extractor.

use serde::{Deserialize, Serialize};
use super::html_parser::{extract_quoted_value, html_to_text};
use super::url_utils::decode_duckduckgo_redirect;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchHit {
    pub title: String,
    pub url: String,
}

pub struct DuckDuckGoParser;

impl DuckDuckGoParser {
    pub fn extract_search_hits(html: &str) -> Vec<SearchHit> {
        let mut hits = Vec::new();
        let mut remaining = html;

        while let Some(anchor_start) = remaining.find("result__a") {
            let Some(after_class) = remaining.get(anchor_start..) else {
                break;
            };
            let Some(href_idx) = after_class.find("href=") else {
                remaining = after_class.get(1..).unwrap_or("");
                continue;
            };
            let Some(href_slice) = after_class.get(href_idx + 5..) else {
                remaining = after_class.get(1..).unwrap_or("");
                continue;
            };
            let Some((url, rest)) = extract_quoted_value(href_slice) else {
                remaining = after_class.get(1..).unwrap_or("");
                continue;
            };
            let Some(close_tag_idx) = rest.find('>') else {
                remaining = after_class.get(1..).unwrap_or("");
                continue;
            };
            let Some(after_tag) = rest.get(close_tag_idx + 1..) else {
                remaining = after_class.get(1..).unwrap_or("");
                continue;
            };
            let Some(end_anchor_idx) = after_tag.find("</a>") else {
                remaining = after_tag.get(1..).unwrap_or("");
                continue;
            };
            let anchor_body = after_tag.get(..end_anchor_idx).unwrap_or("");
            let title = html_to_text(anchor_body);
            if let Some(decoded_url) = decode_duckduckgo_redirect(&url) {
                hits.push(SearchHit {
                    title: title.trim().to_string(),
                    url: decoded_url,
                });
            }
            remaining = after_tag.get(end_anchor_idx + 4..).unwrap_or("");
        }

        hits
    }

    pub fn extract_search_hits_from_generic_links(html: &str) -> Vec<SearchHit> {
        let mut hits = Vec::new();
        let mut remaining = html;

        while let Some(anchor_start) = remaining.find("<a") {
            let Some(after_anchor) = remaining.get(anchor_start..) else {
                break;
            };
            let Some(href_idx) = after_anchor.find("href=") else {
                remaining = after_anchor.get(2..).unwrap_or("");
                continue;
            };
            let Some(href_slice) = after_anchor.get(href_idx + 5..) else {
                remaining = after_anchor.get(2..).unwrap_or("");
                continue;
            };
            let Some((url, rest)) = extract_quoted_value(href_slice) else {
                remaining = after_anchor.get(2..).unwrap_or("");
                continue;
            };
            let Some(close_tag_idx) = rest.find('>') else {
                remaining = after_anchor.get(2..).unwrap_or("");
                continue;
            };
            let Some(after_tag) = rest.get(close_tag_idx + 1..) else {
                remaining = after_anchor.get(2..).unwrap_or("");
                continue;
            };
            let Some(end_anchor_idx) = after_tag.find("</a>") else {
                remaining = after_tag.get(2..).unwrap_or("");
                continue;
            };
            let anchor_body = after_tag.get(..end_anchor_idx).unwrap_or("");
            let title = html_to_text(anchor_body);
            if title.trim().is_empty() {
                remaining = after_tag.get(end_anchor_idx + 4..).unwrap_or("");
                continue;
            }
            let decoded_url = decode_duckduckgo_redirect(&url).unwrap_or(url);
            if decoded_url.starts_with("http://") || decoded_url.starts_with("https://") {
                hits.push(SearchHit {
                    title: title.trim().to_string(),
                    url: decoded_url,
                });
            }
            remaining = after_tag.get(end_anchor_idx + 4..).unwrap_or("");
        }

        hits
    }
}
