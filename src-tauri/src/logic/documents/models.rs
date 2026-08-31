use serde::{Deserialize, Serialize};
use serde_json::Value;

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
