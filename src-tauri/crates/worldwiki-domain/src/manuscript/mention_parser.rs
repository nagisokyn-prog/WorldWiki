#[path = "ascii_scanner.rs"]
mod ascii_scanner;

pub(crate) use ascii_scanner::{find_ascii, split_once_ascii};
use ascii_scanner::strip_html_tags;

pub struct MentionParser;

impl MentionParser {
    pub fn extract_entity_mentions(text: &str) -> Vec<String> {
        let mut results = Vec::new();
        Self::extract_bracket_mentions(text, &mut results);
        Self::extract_markdown_links(text, &mut results);
        Self::extract_html_a_tags(text, &mut results);
        Self::extract_html_span_tags(text, &mut results);
        results
    }

    fn add_mention(results: &mut Vec<String>, val: String) {
        if !val.is_empty() {
            results.push(val);
        }
    }

    fn extract_bracket_mentions(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_bracket(remaining, results) {
            remaining = next;
        }
    }

    fn parse_one_bracket<'a>(text: &'a str, results: &mut Vec<String>) -> Option<&'a str> {
        let (_, after_open) = split_once_ascii(text, b"((")?;
        let (name_raw, mut after_close) = split_once_ascii(after_open, b"))")?;
        Self::add_mention(results, Self::clean_entity_mention(name_raw));

        let trimmed = after_close.trim_ascii_start();
        if let Some(stripped) = trimmed.strip_prefix('[')
            && let Some((meta_raw, rest)) = split_once_ascii(stripped, b"]")
        {
            if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(meta_raw) {
                Self::add_mention(results, id);
            }
            after_close = rest;
        }
        Some(after_close)
    }

    fn extract_markdown_links(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_md_link(remaining, results) {
            remaining = next;
        }
    }

    fn parse_one_md_link<'a>(text: &'a str, results: &mut Vec<String>) -> Option<&'a str> {
        let (_, after_bracket) = split_once_ascii(text, b"[")?;
        let (link_text, after_text) = split_once_ascii(after_bracket, b"]")?;
        let stripped = after_text.strip_prefix('(')?;
        let (url_raw, after_url) = split_once_ascii(stripped, b")")?;

        if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(url_raw) {
            Self::add_mention(results, id);
            Self::add_mention(results, Self::clean_entity_mention(link_text));
        }
        Some(after_url)
    }

    fn extract_html_a_tags(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_html_tag(remaining, b"<a ", b"</a>", results) {
            remaining = next;
        }
    }

    fn extract_html_span_tags(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_html_tag(remaining, b"<span ", b"</span>", results) {
            remaining = next;
        }
    }

    fn parse_one_html_tag<'a>(
        text: &'a str,
        open_tag: &[u8],
        close_tag: &[u8],
        results: &mut Vec<String>,
    ) -> Option<&'a str> {
        let (_, after_open) = split_once_ascii(text, open_tag)?;
        let (tag_and_body, after_close) = split_once_ascii(after_open, close_tag)?;
        let (tag_attrs, text_inside) = split_once_ascii(tag_and_body, b">")?;

        if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(tag_attrs) {
            Self::add_mention(results, id);
        }
        Self::add_mention(results, Self::clean_entity_mention(text_inside));
        Some(after_close)
    }

    pub fn clean_entity_mention(raw: &str) -> String {
        strip_html_tags(raw)
    }
}

#[cfg(test)]
#[path = "mention_parser_tests.rs"]
mod tests;
