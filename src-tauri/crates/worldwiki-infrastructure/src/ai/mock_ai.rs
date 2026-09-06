use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::*;

pub struct MockAiAdapter;

#[async_trait]
impl LlmInferencePort for MockAiAdapter {
    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, DomainError> {
        Ok(InferenceResponse {
            text: format!("Mock AI response to: {}", request.prompt),
            tool_calls: None,
            usage: Some(serde_json::json!({ "total_tokens": 42 })),
        })
    }
}

#[async_trait]
impl LlmStreamPort for MockAiAdapter {
    async fn stream_chat(
        &self,
        _request: StreamRequest,
        sender: tokio::sync::mpsc::Sender<StreamEventDto>,
    ) -> Result<(), DomainError> {
        let _ = sender
            .send(StreamEventDto {
                text_delta: Some("Mock AI stream response".to_string()),
                reasoning_delta: None,
                tool_use: None,
                usage: Some(serde_json::json!({ "total_tokens": 10 })),
                is_done: false,
            })
            .await;
        let _ = sender
            .send(StreamEventDto {
                text_delta: None,
                reasoning_delta: None,
                tool_use: None,
                usage: None,
                is_done: true,
            })
            .await;
        Ok(())
    }
}

#[async_trait]
impl EmbeddingPort for MockAiAdapter {
    async fn embed(&self, _text: &str) -> Result<Vec<f32>, DomainError> {
        Ok(vec![0.0; 768])
    }

    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, DomainError> {
        Ok(texts.iter().map(|_| vec![0.0; 768]).collect())
    }
}

#[async_trait]
impl RAGContextPort for MockAiAdapter {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        _top_k: usize,
    ) -> Result<Vec<Value>, DomainError> {
        Ok(vec![
            serde_json::json!({
                "project_id": project_id,
                "scope": scope,
                "match": format!("Context match for query: '{query}'")
            })
        ])
    }

    async fn retrieve_chapter_multi_hop_context(
        &self,
        project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError> {
        Ok(serde_json::json!({
            "project_id": project_id,
            "chapter_id": chapter_id,
            "participants": [],
            "relations": [],
            "timeline": [],
            "plot_promises": []
        }))
    }
}
