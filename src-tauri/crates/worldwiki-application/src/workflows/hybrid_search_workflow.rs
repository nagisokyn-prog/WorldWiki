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

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use serde_json::json;
    use worldwiki_domain::errors::DomainError;

    struct FakeRagPort {
        fail: bool,
    }

    #[async_trait]
    impl RAGContextPort for FakeRagPort {
        async fn retrieve_context(
            &self,
            _project_id: &str,
            query: &str,
            _scope: &str,
            _top_k: usize,
        ) -> Result<Vec<Value>, DomainError> {
            if self.fail {
                return Err(DomainError::ConstraintViolation("db down".into()));
            }
            Ok(vec![json!({ "query": query })])
        }

        async fn retrieve_chapter_multi_hop_context(
            &self,
            _project_id: &str,
            chapter_id: &str,
        ) -> Result<Value, DomainError> {
            if self.fail {
                return Err(DomainError::Validation("bad chapter".into()));
            }
            Ok(json!({ "chapter_id": chapter_id }))
        }
    }

    #[tokio::test]
    async fn hybrid_search_workflow_positive_and_negative() {
        let wf = HybridSemanticSearchWorkflow::new(Arc::new(FakeRagPort { fail: false }));
        let res = wf.search("p1", "Артур", "all", 5).await.unwrap();
        assert_eq!(res, vec![json!({ "query": "Артур" })]);
        let ctx = wf.get_chapter_multi_hop_context("p1", "ch1").await.unwrap();
        assert_eq!(ctx, json!({ "chapter_id": "ch1" }));

        let wf_err = HybridSemanticSearchWorkflow::new(Arc::new(FakeRagPort { fail: true }));
        assert!(wf_err.search("p1", "q", "all", 5).await.is_err());
        assert!(wf_err.get_chapter_multi_hop_context("p1", "ch1").await.is_err());
    }
}
