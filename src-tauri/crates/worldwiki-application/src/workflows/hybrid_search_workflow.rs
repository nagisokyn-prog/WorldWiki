use std::sync::Arc;
use serde_json::Value;
use worldwiki_ports::ai::RAGContextPort;
use crate::errors::ApplicationError;

pub struct HybridSemanticSearchWorkflow {
    rag_port: Arc<dyn RAGContextPort>,
}

impl HybridSemanticSearchWorkflow {
    pub fn new(rag_port: Arc<dyn RAGContextPort>) -> Self {
        Self { rag_port }
    }

    pub async fn search(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, ApplicationError> {
        let results = self
            .rag_port
            .retrieve_context(project_id, query, scope, top_k)
            .await?;
        Ok(results)
    }

    pub async fn get_chapter_multi_hop_context(
        &self,
        project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, ApplicationError> {
        let ctx = self
            .rag_port
            .retrieve_chapter_multi_hop_context(project_id, chapter_id)
            .await?;
        Ok(ctx)
    }
}
