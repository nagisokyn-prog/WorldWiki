use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchHitDto {
    pub title: String,
    pub url: String,
}

#[async_trait]
pub trait WebResearchPort: Send + Sync {
    async fn search_duckduckgo(&self, query: &str, limit: usize) -> Result<Vec<SearchHitDto>, DomainError>;
    async fn fetch_page(&self, raw_url: &str) -> Result<worldwiki_domain::ai::WebPageEntity, DomainError>;
}

#[async_trait]
pub trait RAGContextPort: Send + Sync {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, DomainError>;

    async fn retrieve_chapter_multi_hop_context(
        &self,
        project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError>;
}
