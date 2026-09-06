use std::fs;
use std::path::Path;
use worldwiki_domain::document::{ExportDocumentRequest, ExportDocumentResponse};

pub fn generate_fb2(
    request: &ExportDocumentRequest,
    target_dir: &Path,
) -> Result<ExportDocumentResponse, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let safe_title = sanitize_filename(&request.title);
    let file_name = format!("{}.fb2", safe_title);
    let output_path = target_dir.join(&file_name);

    let mut xml = String::with_capacity(16384);
    xml.push_str("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
    xml.push_str("<FictionBook xmlns=\"http://www.gribuser.ru/xml/fictionbook/2.0\" xmlns:l=\"http://www.w3.org/1999/xlink\">\n");

    // Description
    xml.push_str("  <description>\n");
    xml.push_str("    <title-info>\n");
    xml.push_str("      <genre>science</genre>\n");
    for author in &request.authors {
        xml.push_str("      <author>\n");
        xml.push_str(&format!("        <nickname>{}</nickname>\n", escape_xml(author)));
        xml.push_str("      </author>\n");
    }
    xml.push_str(&format!("      <book-title>{}</book-title>\n", escape_xml(&request.title)));
    xml.push_str("      <lang>ru</lang>\n");
    xml.push_str("    </title-info>\n");
    xml.push_str("    <document-info>\n");
    xml.push_str("      <author><nickname>WorldWiki Document Engine</nickname></author>\n");
    xml.push_str(&format!("      <id>worldwiki-doc-{}</id>\n", uuid::Uuid::new_v4()));
    xml.push_str("      <version>1.0</version>\n");
    xml.push_str("    </document-info>\n");
    xml.push_str("  </description>\n");

    // Body
    xml.push_str("  <body>\n");
    xml.push_str(&format!("    <title><p>{}</p></title>\n", escape_xml(&request.title)));

    let mut in_section = false;
    let mut footnotes: Vec<(String, String)> = Vec::new();

    for block in &request.blocks {
        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match block_type {
            "heading" => {
                if in_section {
                    xml.push_str("    </section>\n");
                }
                xml.push_str("    <section>\n");
                in_section = true;

                let title_text = extract_inline_text(block.get("content"));
                xml.push_str(&format!("      <title><p>{}</p></title>\n", escape_xml(&title_text)));
            }
            "paragraph" => {
                let p_text = extract_inline_text_with_footnotes(block.get("content"), &mut footnotes);
                xml.push_str(&format!("      <p>{}</p>\n", p_text));
            }
            "figure" => {
                let caption = extract_inline_text(block.get("captionContent"));
                if !caption.is_empty() {
                    xml.push_str(&format!("      <p><i>[Иллюстрация: {}]</i></p>\n", escape_xml(&caption)));
                }
            }
            "quote" => {
                xml.push_str("      <cite>\n");
                if let Some(content) = block.get("content").and_then(|v| v.as_array()) {
                    for inner in content {
                        let text = extract_inline_text(inner.get("content"));
                        xml.push_str(&format!("        <p>{}</p>\n", escape_xml(&text)));
                    }
                }
                xml.push_str("      </cite>\n");
            }
            _ => {}
        }
    }

    if in_section {
        xml.push_str("    </section>\n");
    }
    xml.push_str("  </body>\n");

    // Footnotes body
    if !footnotes.is_empty() {
        xml.push_str("  <body name=\"notes\">\n");
        xml.push_str("    <title><p>Примечания</p></title>\n");
        for (note_id, note_text) in footnotes {
            xml.push_str(&format!("    <section id=\"{}\">\n", note_id));
            xml.push_str(&format!("      <title><p>{}</p></title>\n", note_id));
            xml.push_str(&format!("      <p>{}</p>\n", escape_xml(&note_text)));
            xml.push_str("    </section>\n");
        }
        xml.push_str("  </body>\n");
    }

    xml.push_str("</FictionBook>\n");

    fs::write(&output_path, xml.as_bytes()).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&output_path).map_err(|e| e.to_string())?;

    Ok(ExportDocumentResponse {
        success: true,
        file_path: output_path.to_string_lossy().to_string(),
        file_name,
        file_size_bytes: metadata.len(),
    })
}

fn sanitize_filename(name: &str) -> String {
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

fn escape_xml(src: &str) -> String {
    src.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn extract_inline_text(val: Option<&serde_json::Value>) -> String {
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

fn extract_inline_text_with_footnotes(
    val: Option<&serde_json::Value>,
    footnotes: &mut Vec<(String, String)>,
) -> String {
    let mut out = String::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for node in arr {
            let node_type = node.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if node_type == "text" {
                if let Some(text) = node.get("text").and_then(|t| t.as_str()) {
                    let mut formatted = escape_xml(text);
                    if let Some(marks) = node.get("marks").and_then(|m| m.as_array()) {
                        for m in marks {
                            if let Some(mt) = m.get("type").and_then(|t| t.as_str()) {
                                if mt == "bold" {
                                    formatted = format!("<strong>{}</strong>", formatted);
                                } else if mt == "italic" {
                                    formatted = format!("<emphasis>{}</emphasis>", formatted);
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
                out.push_str(&escape_xml(label));
            }
        }
    }
    out
}
