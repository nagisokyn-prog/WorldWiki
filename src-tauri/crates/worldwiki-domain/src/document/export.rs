use serde::{Deserialize, Serialize};

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
