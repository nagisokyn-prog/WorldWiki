use super::models::{ExportDocumentRequest, ExportDocumentResponse};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

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
        .compression_method(CompressionMethod::Deflated)
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
    zip.write_all(content_types.as_bytes())
        .map_err(|e| e.to_string())?;

    // 2. _rels/.rels
    zip.start_file("_rels/.rels", options)
        .map_err(|e| e.to_string())?;
    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;
    zip.write_all(rels.as_bytes()).map_err(|e| e.to_string())?;

    // 3. word/_rels/document.xml.rels
    zip.start_file("word/_rels/document.xml.rels", options)
        .map_err(|e| e.to_string())?;
    let doc_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"#;
    zip.write_all(doc_rels.as_bytes())
        .map_err(|e| e.to_string())?;

    // 4. word/styles.xml (TNR 14pt, 1.5 line spacing, 1.25 cm indent)
    zip.start_file("word/styles.xml", options)
        .map_err(|e| e.to_string())?;
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
    zip.write_all(styles_xml.as_bytes())
        .map_err(|e| e.to_string())?;

    // 5. word/document.xml
    zip.start_file("word/document.xml", options)
        .map_err(|e| e.to_string())?;
    let mut doc_xml = String::with_capacity(32768);
    doc_xml.push_str(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
"#,
    );

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

    let mut footnotes: Vec<(usize, String)> = Vec::new();

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
                let runs = extract_docx_runs(block.get("content"), &mut footnotes);
                doc_xml.push_str("    <w:p>\n");
                doc_xml.push_str(
                    "      <w:pPr><w:ind w:firstLine=\"709\"/><w:jc w:val=\"both\"/></w:pPr>\n",
                );
                for run in runs {
                    doc_xml.push_str("      <w:r>\n");
                    let has_rpr = run.is_bold || run.is_italic || run.is_superscript;
                    if has_rpr {
                        doc_xml.push_str("        <w:rPr>");
                        if run.is_bold {
                            doc_xml.push_str("<w:b/>");
                        }
                        if run.is_italic {
                            doc_xml.push_str("<w:i/>");
                        }
                        if run.is_superscript {
                            doc_xml.push_str("<w:vertAlign w:val=\"superscript\"/>");
                        }
                        doc_xml.push_str("</w:rPr>\n");
                    }
                    doc_xml.push_str(&format!(
                        "        <w:t xml:space=\"preserve\">{}</w:t>\n",
                        escape_xml(&run.text)
                    ));
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
            "quote" => {
                let text = if let Some(items) = block.get("content").and_then(|v| v.as_array()) {
                    items
                        .iter()
                        .map(|item| {
                            if item.get("type").and_then(|v| v.as_str()) == Some("paragraph") {
                                extract_inline_text(item.get("content"))
                            } else {
                                extract_inline_text(Some(item))
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                } else {
                    extract_inline_text(block.get("content"))
                };
                doc_xml.push_str(&format!(
                    r#"    <w:p>
      <w:pPr>
        <w:pBdr><w:left w:val="single" w:sz="12" w:space="4" w:color="888888"/></w:pBdr>
        <w:ind w:left="709" w:firstLine="0"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:i/></w:rPr>
        <w:t>{}</w:t>
      </w:r>
    </w:p>
"#,
                    escape_xml(&text)
                ));
            }
            "table" => {
                doc_xml.push_str("    <w:tbl>\n");
                doc_xml.push_str("      <w:tblPr><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\"/><w:bottom w:val=\"single\" w:sz=\"4\"/><w:insideH w:val=\"single\" w:sz=\"4\"/><w:insideV w:val=\"single\" w:sz=\"4\"/></w:tblBorders></w:tblPr>\n");
                if let Some(rows) = block.get("rows").and_then(|v| v.as_array()) {
                    for row in rows {
                        doc_xml.push_str("      <w:tr>\n");
                        if let Some(cells) = row.get("cells").and_then(|v| v.as_array()) {
                            for cell in cells {
                                let text = if let Some(cell_content) = cell.get("content").and_then(|v| v.as_array()) {
                                    cell_content
                                        .iter()
                                        .map(|item| extract_inline_text(item.get("content")))
                                        .collect::<Vec<_>>()
                                        .join(" ")
                                } else {
                                    extract_inline_text(cell.get("content"))
                                };
                                doc_xml.push_str(&format!(
                                    "        <w:tc><w:p><w:r><w:t>{}</w:t></w:r></w:p></w:tc>\n",
                                    escape_xml(&text)
                                ));
                            }
                        }
                        doc_xml.push_str("      </w:tr>\n");
                    }
                }
                doc_xml.push_str("    </w:tbl>\n");
            }
            _ => {}
        }
    }

    if !footnotes.is_empty() {
        doc_xml.push_str("    <w:p><w:pPr><w:pBdr><w:top w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"auto\"/></w:pBdr></w:pPr></w:p>\n");
        for (idx, fn_text) in &footnotes {
            doc_xml.push_str(&format!(
                r#"    <w:p>
      <w:pPr><w:ind w:firstLine="0"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="20"/></w:rPr><w:t>[{}] </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>{}</w:t></w:r>
    </w:p>
"#,
                idx,
                escape_xml(fn_text)
            ));
        }
    }

    // Page layout (A4: 11906 x 16838 twips, margins: left 1701 = 30mm, right 567 = 10mm, top 1134 = 20mm, bottom 1134 = 20mm)
    doc_xml.push_str(r#"    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="567" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"#);

    zip.write_all(doc_xml.as_bytes())
        .map_err(|e| e.to_string())?;

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

struct DocxRun {
    is_bold: bool,
    is_italic: bool,
    is_superscript: bool,
    text: String,
}

fn extract_docx_runs(
    val: Option<&serde_json::Value>,
    footnotes: &mut Vec<(usize, String)>,
) -> Vec<DocxRun> {
    let mut runs = Vec::new();
    if let Some(arr) = val.and_then(|v| v.as_array()) {
        for node in arr {
            let node_type = node.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if node_type == "footnote_reference" {
                let note_idx = footnotes.len() + 1;
                let note_content = extract_inline_text(node.get("content"));
                footnotes.push((note_idx, note_content));
                runs.push(DocxRun {
                    is_bold: false,
                    is_italic: false,
                    is_superscript: true,
                    text: format!("[{}]", note_idx),
                });
                continue;
            }

            let text = node.get("text").and_then(|t| t.as_str()).unwrap_or("");
            if text.is_empty() {
                if let Some(label) = node.get("resolvedLabel").and_then(|l| l.as_str()) {
                    runs.push(DocxRun {
                        is_bold: false,
                        is_italic: false,
                        is_superscript: false,
                        text: label.to_string(),
                    });
                }
                continue;
            }

            let mut is_bold = false;
            let mut is_italic = false;

            if let Some(marks) = node.get("marks").and_then(|m| m.as_array()) {
                for m in marks {
                    if let Some(mark_type) = m.get("type").and_then(|t| t.as_str()) {
                        if mark_type == "bold" {
                            is_bold = true;
                        }
                        if mark_type == "italic" {
                            is_italic = true;
                        }
                    }
                }
            }

            runs.push(DocxRun {
                is_bold,
                is_italic,
                is_superscript: false,
                text: text.to_string(),
            });
        }
    }
    runs
}
