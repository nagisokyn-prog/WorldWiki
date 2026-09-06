use std::sync::Arc;
use worldwiki_domain::ai::{
    HardwareInfo, MemoryEstimation, RecommendedModelCard, InstalledModelInfo, ToolPermissionConfig,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{HardwareDetectorPort, LocalModelManagerPort, PermissionsPort};

#[derive(Clone)]
pub struct LocalAiServices {
    hardware_detector: Arc<dyn HardwareDetectorPort>,
    model_manager: Arc<dyn LocalModelManagerPort>,
    permissions_catalog: Arc<dyn PermissionsPort>,
}

impl LocalAiServices {
    pub fn new(
        hardware_detector: Arc<dyn HardwareDetectorPort>,
        model_manager: Arc<dyn LocalModelManagerPort>,
        permissions_catalog: Arc<dyn PermissionsPort>,
    ) -> Self {
        Self {
            hardware_detector,
            model_manager,
            permissions_catalog,
        }
    }

    pub fn get_hardware_info(&self) -> HardwareInfo {
        self.hardware_detector.get_hardware_info()
    }

    pub fn calculate_quantization_estimates(
        &self,
        params_billions: f32,
        context_tokens: Option<usize>,
    ) -> Vec<MemoryEstimation> {
        self.hardware_detector
            .calculate_quantization_estimates(params_billions, context_tokens)
    }

    pub fn get_recommended_local_models(&self) -> Vec<RecommendedModelCard> {
        self.hardware_detector.get_recommended_local_models()
    }

    pub fn list_installed_models(&self) -> Result<Vec<InstalledModelInfo>, DomainError> {
        self.model_manager.list_installed()
    }

    pub fn load_local_model(&self, filename: &str) -> Result<String, DomainError> {
        self.model_manager.load_model(filename)
    }

    pub fn unload_local_model(&self, filename: &str) -> Result<String, DomainError> {
        self.model_manager.unload_model(filename)
    }

    pub fn unload_all_local_models(&self) -> Result<String, DomainError> {
        self.model_manager.unload_all()
    }

    pub fn delete_local_model(&self, filename: &str) -> Result<String, DomainError> {
        self.model_manager.delete_model(filename)
    }

    pub fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig> {
        self.permissions_catalog.get_tool_permissions_catalog()
    }
}
