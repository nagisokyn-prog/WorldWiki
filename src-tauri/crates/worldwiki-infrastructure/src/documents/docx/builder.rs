use super::types::DocxRun;
use crate::documents::utils::{escape_xml, extract_inline_text};
use serde_json::Value;

pub(crate) fn extract_docx_runs(
    val: Option<&Value>,
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

pub(crate) fn append_block_xml(
    block: &Value,
    doc_xml: &mut String,
    footnotes: &mut Vec<(usize, String)>,
) {
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
            let runs = extract_docx_runs(block.get("content"), footnotes);
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
                            let text = if let Some(cell_content) =
                                cell.get("content").and_then(|v| v.as_array())
                            {
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
