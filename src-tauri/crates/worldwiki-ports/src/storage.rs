use async_trait::async_trait;
use worldwiki_domain::document::{ExportConfig, SemanticDocument};
use worldwiki_domain::errors::DomainError;

#[async_trait]
pub trait FileSystemPort: Send + Sync {
    async fn read_file(&self, path: &str) -> Result<Vec<u8>, DomainError>;
    async fn write_file(&self, path: &str, data: &[u8]) -> Result<(), DomainError>;
    async fn exists(&self, path: &str) -> Result<bool, DomainError>;
}

#[async_trait]
pub trait DocumentCompilerPort: Send + Sync {
    async fn compile(
        &self,
        document: &SemanticDocument,
        config: &ExportConfig,
    ) -> Result<Vec<u8>, DomainError>;
}
