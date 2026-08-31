use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use super::models::{ExportDocumentRequest, ExportDocumentResponse};

pub fn generate_epub(
    request: &ExportDocumentRequest,
    target_dir: &Path,
) -> Result<ExportDocumentResponse, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let safe_title = sanitize_filename(&request.title);
    let file_name = format!("{}.epub", safe_title);
    let output_path = target_dir.join(&file_name);

    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);

    // 1. mimetype (Must be first, uncompressed)
    let stored_options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::STORED)
        .unix_permissions(0o644);
    zip.start_file("mimetype", stored_options)
        .map_err(|e| e.to_string())?;
    zip.write_all(b"application/epub+zip")
        .map_err(|e| e.to_string())?;

    let deflated_options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::DEFLATED)
        .unix_permissions(0o644);

    // 2. META-INF/container.xml
    zip.start_file("META-INF/container.xml", deflated_options)
        .map_err(|e| e.to_string())?;
    let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;
    zip.write_all(container_xml.as_bytes())
        .map_err(|e| e.to_string())?;

    // 3. OEBPS/style.css
    zip.start_file("OEBPS/style.css", deflated_options)
        .map_err(|e| e.to_string())?;
    let css = r#"
body { font-family: serif; margin: 5%; line-height: 1.5; }
h1, h2, h3 { font-family: sans-serif; text-align: center; }
p { text-indent: 1.5em; margin: 0; }
figure { text-align: center; margin: 1em 0; }
figcaption { font-size: 0.9em; color: #555; }
.footnote { font-size: 0.85em; border-top: 1px solid #ccc; margin-top: 2em; padding-top: 0.5em; }
"#;
    zip.write_all(css.as_bytes()).map_err(|e| e.to_string())?;

    // 4. OEBPS/chapter1.xhtml
    zip.start_file("OEBPS/chapter1.xhtml", deflated_options)
        .map_err(|e| e.to_string())?;

    let mut html = String::with_capacity(16384);
    html.push_str("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
    html.push_str("<!DOCTYPE html>\n");
    html.push_str("<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\">\n");
    html.push_str("<head>\n");
    html.push_str(&format!("  <title>{}</title>\n", escape_html(&request.title)));
    html.push_str("  <link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\"/>\n");
    html.push_str("</head>\n<body>\n");
    html.push_str(&format!("  <h1>{}</h1>\n", escape_html(&request.title)));

    let mut footnotes: Vec<(String, String)> = Vec::new();

    for block in &request.blocks {
        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
        match block_type {
            "heading" => {
                let level = block.get("level").and_then(|l| l.as_u64()).unwrap_or(2);
                let title_text = extract_inline_text(block.get("content"));
                html.push_str(&format!("  <h{}>{}</h{}>\n", level, escape_html(&title_text), level));
            }
            "paragraph" => {
                let p_text = extract_inline_text_with_footnotes(block.get("content"), &mut footnotes);
                html.push_str(&format!("  <p>{}</p>\n", p_text));
            }
            "figure" => {
                let caption = extract_inline_text(block.get("captionContent"));
                html.push_str("  <figure>\n");
                html.push_str(&format!("    <figcaption>{}</figcaption>\n", escape_html(&caption)));
                html.push_str("  </figure>\n");
            }
            "quote" => {
                html.push_str("  <blockquote>\n");
                if let Some(content) = block.get("content").and_then(|v| v.as_array()) {
                    for inner in content {
                        let text = extract_inline_text(inner.get("content"));
                        html.push_str(&format!("    <p>{}</p>\n", escape_html(&text)));
                    }
                }
                html.push_str("  </blockquote>\n");
            }
            _ => {}
        }
    }

    if !footnotes.is_empty() {
        html.push_str("  <section class=\"footnote\" epub:type=\"footnotes\">\n");
        html.push_str("    <h3>Примечания</h3>\n");
        for (note_id, note_text) in footnotes {
            html.push_str(&format!("    <aside id=\"{}\" epub:type=\"footnote\"><p><b>[{}]</b> {}</p></aside>\n", note_id, note_id, escape_html(&note_text)));
        }
        html.push_str("  </section>\n");
    }

    html.push_str("</body>\n</html>\n");
    zip.write_all(html.as_bytes()).map_err(|e| e.to_string())?;

    // 5. OEBPS/toc.xhtml (EPUB 3 Navigation)
    zip.start_file("OEBPS/toc.xhtml", deflated_options)
        .map_err(|e| e.to_string())?;
    let toc_xhtml = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Навигация</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h2>Содержание</h2>
    <ol>
      <li><a href="chapter1.xhtml">{}</a></li>
    </ol>
  </nav>
</body>
</html>"#,
        escape_html(&request.title)
    );
    zip.write_all(toc_xhtml.as_bytes()).map_err(|e| e.to_string())?;

    // 6. OEBPS/content.opf
    zip.start_file("OEBPS/content.opf", deflated_options)
        .map_err(|e| e.to_string())?;
    let doc_uuid = uuid::Uuid::new_v4().to_string();
    let authors_meta = request
        .authors
        .iter()
        .map(|a| format!("    <dc:creator>{}</dc:creator>", escape_html(a)))
        .collect::<Vec<_>>()
        .join("\n");

    let opf = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:{}</dc:identifier>
    <dc:title>{}</dc:title>
    <dc:language>ru</dc:language>
{}
    <meta property="dcterms:modified">2026-08-31T12:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>"#,
        doc_uuid,
        escape_html(&request.title),
        authors_meta
    );
    zip.write_all(opf.as_bytes()).map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;

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

fn escape_html(src: &str) -> String {
    src.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
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
                    out.push_str(&escape_html(text));
                }
            } else if node_type == "footnote_reference" {
                let note_idx = footnotes.len() + 1;
                let note_id = format!("fn{}", note_idx);
                let note_content = extract_inline_text(node.get("content"));
                footnotes.push((note_id.clone(), note_content));
                out.push_str(&format!("<a epub:type=\"noteref\" href=\"#{}\">[{}]</a>", note_id, note_idx));
            } else if node_type == "cross_reference" {
                let label = node.get("resolvedLabel").and_then(|l| l.as_str()).unwrap_or("ссылка");
                out.push_str(&escape_html(label));
            }
        }
    }
    out
}
