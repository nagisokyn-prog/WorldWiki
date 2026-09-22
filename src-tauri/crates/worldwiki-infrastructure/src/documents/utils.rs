pub fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    if cleaned.trim().is_empty() {
        "Документ".to_string()
    } else {
        cleaned.trim().to_string()
    }
}

pub fn escape_xml(src: &str) -> String {
    src.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn escape_html(src: &str) -> String {
    src.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub fn extract_inline_text(val: Option<&serde_json::Value>) -> String {
    let mut out = String::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for node in arr {
            if let Some(text) = node.get("text").and_then(|t| t.as_str()) {
                out.push_str(text);
            }
        }
    }
    out
}

pub fn extract_inline_text_with_footnotes(
    val: Option<&serde_json::Value>,
    footnotes: &mut Vec<(String, String)>,
) -> String {
    let mut out = String::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for node in arr {
            let node_type = node.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if node_type == "text" {
                if let Some(text) = node.get("text").and_then(|t| t.as_str()) {
                    let mut formatted = escape_html(text);
                    if let Some(marks) = node.get("marks").and_then(|m| m.as_array()) {
                        for m in marks {
                            if let Some(mt) = m.get("type").and_then(|t| t.as_str()) {
                                match mt {
                                    "bold" => formatted = format!("<strong>{}</strong>", formatted),
                                    "italic" => formatted = format!("<em>{}</em>", formatted),
                                    "code" => formatted = format!("<code>{}</code>", formatted),
                                    _ => {}
                                }
                            }
                        }
                    }
                    out.push_str(&formatted);
                }
            } else if node_type == "footnote_reference" {
                let note_idx = footnotes.len() + 1;
                let note_id = format!("fn-{}", note_idx);
                let note_content = extract_inline_text(node.get("content"));
                footnotes.push((note_id.clone(), note_content));
                out.push_str(&format!("<a type=\"note\" l:href=\"#{}\">[{}]</a>", note_id, note_idx));
            } else if node_type == "cross_reference" {
                let label = node.get("resolvedLabel").and_then(|l| l.as_str()).unwrap_or("ссылка");
                out.push_str(&escape_html(label));
            }
        }
    }
    out
}
