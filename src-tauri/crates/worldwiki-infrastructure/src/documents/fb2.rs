use std::fs;
use std::path::Path;
use worldwiki_domain::document::{ExportDocumentRequest, ExportDocumentResponse};
use worldwiki_domain::errors::DomainError;

use super::utils::{
    escape_xml, extract_inline_text, extract_inline_text_fb2_with_footnotes, sanitize_filename,
};

pub fn generate_fb2(
    request: &ExportDocumentRequest,
    target_dir: &Path,
) -> Result<ExportDocumentResponse, DomainError> {
    fs::create_dir_all(target_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

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
                let p_text = extract_inline_text_fb2_with_footnotes(block.get("content"), &mut footnotes);
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

    fs::write(&output_path, xml.as_bytes()).map_err(|e| DomainError::Validation(e.to_string()))?;
    let metadata = fs::metadata(&output_path).map_err(|e| DomainError::Validation(e.to_string()))?;

    Ok(ExportDocumentResponse {
        success: true,
        file_path: output_path.to_string_lossy().to_string(),
        file_name,
        file_size_bytes: metadata.len(),
    })
}
