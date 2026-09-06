use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Docx,
    Epub,
    Fb2,
    Markdown,
    Pdf,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExportConfig {
    pub format: ExportFormat,
    pub project_id: String,
    pub volume_ids: Vec<String>,
    pub include_synopsis: bool,
    pub include_lore_appendix: bool,
    pub gost_margins: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDocumentRequest {
    pub project_name: String,
    pub title: String,
    pub authors: Vec<String>,
    pub profile_id: String,
    pub blocks: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDocumentResponse {
    pub success: bool,
    pub file_path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
}
