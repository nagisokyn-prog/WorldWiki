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

    fn add_unique(results: &mut Vec<String>, val: String) {
        if !val.is_empty() && !results.contains(&val) {
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
        let (_, after_open) = text.split_once("((")?;
        let (name_raw, mut after_close) = after_open.split_once("))")?;
        Self::add_unique(results, Self::clean_entity_mention(name_raw));

        let trimmed = after_close.trim_start();
        if let Some(stripped) = trimmed.strip_prefix('[')
            && let Some((meta_raw, rest)) = stripped.split_once(']')
        {
            if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(meta_raw) {
                Self::add_unique(results, id);
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
        let (_, after_bracket) = text.split_once('[')?;
        let (link_text, after_text) = after_bracket.split_once(']')?;
        let stripped = after_text.strip_prefix('(')?;
        let (url_raw, after_url) = stripped.split_once(')')?;

        if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(url_raw) {
            Self::add_unique(results, id);
            Self::add_unique(results, Self::clean_entity_mention(link_text));
        }
        Some(after_url)
    }

    fn extract_html_a_tags(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_html_tag(remaining, "<a ", "</a>", results) {
            remaining = next;
        }
    }

    fn extract_html_span_tags(text: &str, results: &mut Vec<String>) {
        let mut remaining = text;
        while let Some(next) = Self::parse_one_html_tag(remaining, "<span ", "</span>", results) {
            remaining = next;
        }
    }

    fn parse_one_html_tag<'a>(
        text: &'a str,
        open_tag: &str,
        close_tag: &str,
        results: &mut Vec<String>,
    ) -> Option<&'a str> {
        let (_, after_open) = text.split_once(open_tag)?;
        let (tag_and_body, after_close) = after_open.split_once(close_tag)?;
        let (tag_attrs, text_inside) = tag_and_body.split_once('>')?;

        if let Some(id) = crate::manuscript::IdExtractor::extract_record_id_from_metadata(tag_attrs) {
            Self::add_unique(results, id);
        }
        Self::add_unique(results, Self::clean_entity_mention(text_inside));
        Some(after_close)
    }

    fn clean_entity_mention(raw: &str) -> String {
        let mut clean = String::with_capacity(raw.len());
        let mut in_tag = false;
        for c in raw.chars() {
            if c == '<' {
                in_tag = true;
            } else if c == '>' {
                in_tag = false;
            } else if !in_tag {
                clean.push(c);
            }
        }
        clean.trim().to_string()
    }
}
