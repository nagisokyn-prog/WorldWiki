pub struct MentionParser;

#[inline]
fn utf8_char_width(b: u8) -> usize {
    if b < 0x80 {
        1
    } else if b < 0xE0 {
        2
    } else if b < 0xF0 {
        3
    } else {
        4
    }
}

pub(crate) fn find_ascii(s: &str, needle: &[u8]) -> Option<usize> {
    let haystack = s.as_bytes();
    let n_len = needle.len();
    if n_len == 0 || haystack.len() < n_len {
        return None;
    }
    let limit = haystack.len() - n_len;
    let mut i = 0;
    while i <= limit {
        let b = haystack[i];
        if b < 0x80 {
            let is_match = match n_len {
                1 => b == needle[0],
                2 => b == needle[0] && haystack[i + 1] == needle[1],
                3 => {
                    b == needle[0]
                        && haystack[i + 1] == needle[1]
                        && haystack[i + 2] == needle[2]
                }
                4 => {
                    b == needle[0]
                        && haystack[i + 1] == needle[1]
                        && haystack[i + 2] == needle[2]
                        && haystack[i + 3] == needle[3]
                }
                _ => haystack.get(i..i + n_len) == Some(needle),
            };
            if is_match {
                return Some(i);
            }
            i += 1;
        } else {
            i += utf8_char_width(b);
        }
    }
    None
}

pub(crate) fn split_once_ascii<'a>(s: &'a str, needle: &[u8]) -> Option<(&'a str, &'a str)> {
    let idx = find_ascii(s, needle)?;
    let before = s.get(..idx)?;
    let after = s.get(idx + needle.len()..)?;
    Some((before, after))
}

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
        let bytes = raw.as_bytes();
        let mut clean = String::with_capacity(bytes.len());
        let mut in_tag = false;
        let mut chunk_start = 0usize;
        let mut i = 0usize;

        while i < bytes.len() {
            let b = bytes[i];
            if b == b'<' || b == b'>' {
                if !in_tag && chunk_start < i
                    && let Some(sub) = raw.get(chunk_start..i)
                {
                    clean.push_str(sub);
                }
                in_tag = b == b'<';
                chunk_start = i + 1;
                i += 1;
            } else {
                i += utf8_char_width(b);
            }
        }
        if !in_tag && chunk_start < bytes.len()
            && let Some(sub) = raw.get(chunk_start..bytes.len())
        {
            clean.push_str(sub);
        }
        clean.trim_ascii().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manuscript::IdExtractor;

    #[test]
    fn test_invariant_1_exhaustive_utf8_and_slice_safety() {
        let tokens = [
            "((",
            "))",
            "[",
            "]",
            "entities:42",
            "a",
            "Я",
            "東",
            "👑",
            "<a ",
            "</a>",
            ">",
            "%D0%9F",
            "%",
        ];
        for &t0 in &tokens {
            for &t1 in &tokens {
                for &t2 in &tokens {
                    let s = format!("{}{}{}", t0, t1, t2);
                    let mentions = MentionParser::extract_entity_mentions(&s);
                    for m in mentions {
                        assert!(!m.is_empty());
                    }
                    let _ = IdExtractor::extract_record_id_from_metadata(&s);
                }
            }
        }
    }

    #[test]
    fn test_invariant_2_exhaustive_clean_entity_mention_idempotence() {
        let alphabet = ["<", ">", " ", "a", "Я", "👑", "\0"];
        for &c0 in &alphabet {
            for &c1 in &alphabet {
                for &c2 in &alphabet {
                    for &c3 in &alphabet {
                        let s = format!("{}{}{}{}", c0, c1, c2, c3);
                        let s1 = MentionParser::clean_entity_mention(&s);
                        let s2 = MentionParser::clean_entity_mention(&s1);
                        assert_eq!(s1, s2, "Failed idempotence for: {:?}", s);
                    }
                }
            }
        }
    }

    #[test]
    fn test_invariant_3_no_redos_and_crash_freedom() {
        let pathological = [
            "(".repeat(10_000),
            "((".repeat(5_000),
            "<a href=\"unclosed".repeat(2_000),
            "<span data-entity-id=\"entities:1\"".repeat(2_000),
            "[link](entities:1".repeat(2_000),
            "((\0\0\0))[\0entities:null_test\0]".repeat(1_000),
        ];
        for sample in &pathological {
            let _ = MentionParser::extract_entity_mentions(sample);
            let _ = IdExtractor::extract_record_id_from_metadata(sample);
        }
    }
}
