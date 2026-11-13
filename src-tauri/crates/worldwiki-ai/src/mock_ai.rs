use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use worldwiki_domain::ai::{
    HardwareInfo, InstalledModelInfo, MemoryEstimation, RecommendedModelCard,
    ToolPermissionConfig,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::*;

#[derive(Default, Clone, Debug)]
pub struct MockAiAdapter;

impl MockAiAdapter {
    pub fn new() -> Self {
        Self
    }
}

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
        sender
            .send(StreamEventDto {
                text_delta: Some("Mock AI stream response".to_string()),
                reasoning_delta: None,
                tool_use: None,
                usage: Some(serde_json::json!({ "total_tokens": 10 })),
                is_done: true,
            })
            .await
            .map_err(|e| DomainError::ConstraintViolation(format!("Mock AI stream send failed: {}", e)))?;
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

impl HardwareDetectorPort for MockAiAdapter {
    fn get_hardware_info(&self) -> HardwareInfo {
        HardwareInfo {
            total_ram_gb: 16.0,
            free_ram_gb: 8.0,
            gpu_name: "Mock GPU".to_string(),
            total_vram_gb: 8.0,
            free_vram_gb: 6.0,
            is_gpu_available: false,
        }
    }

    fn calculate_quantization_estimates(
        &self,
        _params_billions: f32,
        _context_tokens: Option<usize>,
    ) -> Vec<MemoryEstimation> {
        vec![
            MemoryEstimation {
                quant_name: "Q4_K_M".to_string(),
                estimated_vram_gb: 4.5,
                status: "ok".to_string(),
                is_recommended: true,
                size_gb: 4.0,
            }
        ]
    }

    fn get_recommended_local_models(&self) -> Vec<RecommendedModelCard> {
        Vec::new()
    }
}

impl LocalModelManagerPort for MockAiAdapter {
    fn list_installed(&self) -> Result<Vec<InstalledModelInfo>, DomainError> {
        Ok(Vec::new())
    }

    fn load_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Mock model loaded".to_string())
    }

    fn unload_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Mock model unloaded".to_string())
    }

    fn unload_all(&self) -> Result<String, DomainError> {
        Ok("All mock models unloaded".to_string())
    }

    fn delete_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Mock model deleted".to_string())
    }
}

impl PermissionsPort for MockAiAdapter {
    fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig> {
        Vec::new()
    }

    fn save_tool_permission(&self, _tool_id: &str, _level: &str) -> Result<(), DomainError> {
        Ok(())
    }

    fn save_all_tool_permissions(&self, _permissions: &HashMap<String, String>) -> Result<(), DomainError> {
        Ok(())
    }
}
