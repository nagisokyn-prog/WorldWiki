pub mod docx;
pub mod epub;
pub mod fb2;

pub use docx::generate_docx;
pub use epub::generate_epub;
pub use fb2::generate_fb2;

use async_trait::async_trait;
use worldwiki_domain::document::{ExportConfig, SemanticDocument};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::storage::DocumentCompilerPort;

pub struct PlainTextDocumentCompiler;

#[async_trait]
impl DocumentCompilerPort for PlainTextDocumentCompiler {
    async fn compile(
        &self,
        document: &SemanticDocument,
        _config: &ExportConfig,
    ) -> Result<Vec<u8>, DomainError> {
        let mut output = String::new();
        output.push_str(&format!("# {}\n\n", document.title));
        if let Some(c) = &document.root.content {
            output.push_str(c);
        }
        Ok(output.into_bytes())
    }
}
