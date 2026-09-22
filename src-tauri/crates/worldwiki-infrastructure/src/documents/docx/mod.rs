pub(crate) mod builder;
pub(crate) mod styles;
pub(crate) mod types;

pub use types::DocxRun;

use builder::append_block_xml;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use styles::{CONTENT_TYPES_XML, DOC_RELS_XML, RELS_XML, STYLES_XML};
use worldwiki_domain::document::{ExportDocumentRequest, ExportDocumentResponse};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

use super::utils::{escape_xml, sanitize_filename};

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
    zip.write_all(CONTENT_TYPES_XML.as_bytes())
        .map_err(|e| e.to_string())?;

    // 2. _rels/.rels
    zip.start_file("_rels/.rels", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(RELS_XML.as_bytes()).map_err(|e| e.to_string())?;

    // 3. word/_rels/document.xml.rels
    zip.start_file("word/_rels/document.xml.rels", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(DOC_RELS_XML.as_bytes())
        .map_err(|e| e.to_string())?;

    // 4. word/styles.xml
    zip.start_file("word/styles.xml", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(STYLES_XML.as_bytes())
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
        append_block_xml(block, &mut doc_xml, &mut footnotes);
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

    // Page layout
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
