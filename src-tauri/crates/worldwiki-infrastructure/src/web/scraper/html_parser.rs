//! Safe HTML to text extraction, entity decoding, and metadata parsing without panics.

pub fn html_to_text(html: &str) -> String {
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

pub fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

pub fn collapse_whitespace(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn extract_title(raw_body: &str, content_type: &str) -> Option<String> {
    if !content_type.contains("html") {
        return None;
    }

    let lowered = raw_body.to_lowercase();
    let start = lowered.find("<title>")?;
    let after = start + "<title>".len();
    let remaining_lower = lowered.get(after..)?;
    let end_rel = remaining_lower.find("</title>")?;
    let title_slice = raw_body.get(after..after + end_rel)?;
    let title = collapse_whitespace(&decode_html_entities(title_slice));
    if !title.is_empty() {
        Some(title)
    } else {
        None
    }
}

pub fn extract_quoted_value(input: &str) -> Option<(String, &str)> {
    let quote = input.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let rest = input.get(quote.len_utf8()..)?;
    let end = rest.find(quote)?;
    let val = rest.get(..end)?;
    let after_quote = rest.get(end + quote.len_utf8()..)?;
    Some((val.to_string(), after_quote))
}
