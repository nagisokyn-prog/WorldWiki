use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use super::models::{ExportDocumentRequest, ExportDocumentResponse};

pub fn generate_docx(
    request: &ExportDocumentRequest,
    target_dir: &Path,
) -> Result<ExportDocumentResponse, String> {
    fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    let safe_title = sanitize_filename(&request.title);
    let file_name = format!("{}.docx", safe_title);
    let output_path = target_dir.join(&file_name);

    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);

    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::DEFLATED)
        .unix_permissions(0o644);

    // 1. [Content_Types].xml
    zip.start_file("[Content_Types].xml", options)
        .map_err(|e| e.to_string())?;
    let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"#;
    zip.write_all(content_types.as_bytes()).map_err(|e| e.to_string())?;

    // 2. _rels/.rels
    zip.start_file("_rels/.rels", options).map_err(|e| e.to_string())?;
    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;
    zip.write_all(rels.as_bytes()).map_err(|e| e.to_string())?;

    // 3. word/_rels/document.xml.rels
    zip.start_file("word/_rels/document.xml.rels", options).map_err(|e| e.to_string())?;
    let doc_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"#;
    zip.write_all(doc_rels.as_bytes()).map_err(|e| e.to_string())?;

    // 4. word/styles.xml (TNR 14pt, 1.5 line spacing, 1.25 cm indent)
    zip.start_file("word/styles.xml", options).map_err(|e| e.to_string())?;
    let styles_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="28"/> <!-- 14pt (28 half-points) -->
        <w:lang w:val="ru-RU"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto"/> <!-- 1.5 line spacing -->
        <w:ind w:firstLine="709"/> <!-- 1.25 cm (709 twips) -->
        <w:jc w:val="both"/> <!-- Justify -->
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>"#;
    zip.write_all(styles_xml.as_bytes()).map_err(|e| e.to_string())?;

    // 5. word/document.xml
    zip.start_file("word/document.xml", options).map_err(|e| e.to_string())?;
    let mut doc_xml = String::with_capacity(32768);
    doc_xml.push_str(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
"#);

    // Title
    doc_xml.push_str(&format!(
        r#"    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="240" w:after="240"/>
        <w:ind w:firstLine="0"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        <w:t>{}</w:t>
      </w:r>
    </w:p>
"#,
        escape_xml(&request.title)
    ));

    for block in &request.blocks {
        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
        match block_type {
            "heading" => {
                let text = extract_inline_text(block.get("content"));
                doc_xml.push_str(&format!(
                    r#"    <w:p>
      <w:pPr>
        <w:bCs/>
        <w:spacing w:before="240" w:after="120"/>
        <w:ind w:firstLine="709"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
        <w:t>{}</w:t>
      </w:r>
    </w:p>
"#,
                    escape_xml(&text)
                ));
            }
            "paragraph" => {
                let runs = extract_docx_runs(block.get("content"));
                doc_xml.push_str("    <w:p>\n");
                doc_xml.push_str("      <w:pPr><w:ind w:firstLine=\"709\"/><w:jc w:val=\"both\"/></w:pPr>\n");
                for (is_bold, is_italic, text) in runs {
                    doc_xml.push_str("      <w:r>\n");
                    if is_bold || is_italic {
                        doc_xml.push_str("        <w:rPr>");
                        if is_bold { doc_xml.push_str("<w:b/>"); }
                        if is_italic { doc_xml.push_str("<w:i/>"); }
                        doc_xml.push_str("</w:rPr>\n");
                    }
                    doc_xml.push_str(&format!("        <w:t xml:space=\"preserve\">{}</w:t>\n", escape_xml(&text)));
                    doc_xml.push_str("      </w:r>\n");
                }
                doc_xml.push_str("    </w:p>\n");
            }
            "figure" => {
                let caption = extract_inline_text(block.get("captionContent"));
                doc_xml.push_str(&format!(
                    r#"    <w:p>
      <w:pPr><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="24"/></w:rPr>
        <w:t>{}</w:t>
      </w:r>
    </w:p>
"#,
                    escape_xml(&caption)
                ));
            }
            _ => {}
        }
    }

    // Page layout (A4: 11906 x 16838 twips, margins: left 1701 = 30mm, right 567 = 10mm, top 1134 = 20mm, bottom 1134 = 20mm)
    doc_xml.push_str(r#"    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="567" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"#);

    zip.write_all(doc_xml.as_bytes()).map_err(|e| e.to_string())?;

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

fn extract_docx_runs(val: Option<&serde_json::Value>) -> Vec<(bool, bool, String)> {
    let mut runs = Vec::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for node in arr {
            let text = node.get("text").and_then(|t| t.as_str()).unwrap_or("");
            if text.is_empty() {
                if let Some(label) = node.get("resolvedLabel").and_then(|l| l.as_str()) {
                    runs.push((false, false, label.to_string()));
                }
                continue;
            }

            let mut is_bold = false;
            let mut is_italic = false;

            if let Some(marks) = node.get("marks").and_then(|m| m.as_array()) {
                for m in marks {
                    if let Some(mark_type) = m.get("type").and_then(|t| t.as_str()) {
                        if mark_type == "bold" { is_bold = true; }
                        if mark_type == "italic" { is_italic = true; }
                    }
                }
            }

            runs.push((is_bold, is_italic, text.to_string()));
        }
    }
    runs
}
