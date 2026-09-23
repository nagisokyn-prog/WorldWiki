use async_trait::async_trait;
use worldwiki_domain::ai::{
    HardwareInfo, HfModelCard, InstalledModelInfo, MemoryEstimation, RecommendedModelCard,
};
use worldwiki_domain::errors::DomainError;

pub trait HardwareDetectorPort: Send + Sync {
    fn get_hardware_info(&self) -> HardwareInfo;
    fn calculate_quantization_estimates(
        &self,
        params_billions: f32,
        context_tokens: Option<usize>,
    ) -> Vec<MemoryEstimation>;
    fn get_recommended_local_models(&self) -> Vec<RecommendedModelCard>;
}

pub trait LocalModelManagerPort: Send + Sync {
    fn list_installed(&self) -> Result<Vec<InstalledModelInfo>, DomainError>;
    fn load_model(&self, filename: &str) -> Result<String, DomainError>;
    fn unload_model(&self, filename: &str) -> Result<String, DomainError>;
    fn unload_all(&self) -> Result<String, DomainError>;
    fn delete_model(&self, filename: &str) -> Result<String, DomainError>;
}

#[async_trait]
pub trait ModelHubPort: Send + Sync {
    async fn fetch_models(
        &self,
        query: &str,
        task: Option<&str>,
        sort: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<HfModelCard>, DomainError>;
}
