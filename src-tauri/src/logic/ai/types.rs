use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum ModelKind {
    #[serde(rename = "generation")]
    Generation,
    #[serde(rename = "embedding")]
    Embedding,
    #[serde(rename = "reranker")]
    Reranker,
    #[serde(rename = "vision")]
    Vision,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum RuntimeKind {
    #[serde(rename = "cloud")]
    Cloud,
    #[serde(rename = "llama_cpp")]
    LlamaCpp,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq, Default)]
#[ts(export)]
pub enum ExecutionPolicy {
    #[serde(rename = "direct")]
    Direct,
    #[serde(rename = "tool_assisted")]
    #[default]
    ToolAssisted,
    #[serde(rename = "agentic")]
    Agentic,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum PermissionLevel {
    #[serde(rename = "allow")]
    Allow,
    #[serde(rename = "ask")]
    Ask,
    #[serde(rename = "deny")]
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum ToolCategory {
    #[serde(rename = "read")]
    Read,
    #[serde(rename = "edit")]
    Edit,
    #[serde(rename = "analytics")]
    Analytics,
    #[serde(rename = "system")]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum RiskLevel {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct ToolPermissionConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: ToolCategory,
    pub risk: RiskLevel,
    pub default_level: PermissionLevel,
    pub user_level: Option<PermissionLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS, PartialEq, Eq)]
#[ts(export)]
pub enum ModelLifecycleState {
    #[serde(rename = "installed")]
    Installed,
    #[serde(rename = "loading")]
    Loading,
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "busy")]
    Busy,
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "sleeping")]
    Sleeping,
    #[serde(rename = "unloading")]
    Unloading,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct HardwareInfo {
    pub total_ram_gb: f32,
    pub free_ram_gb: f32,
    pub gpu_name: String,
    pub total_vram_gb: f32,
    pub free_vram_gb: f32,
    pub is_gpu_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct MemoryEstimation {
    pub quant_name: String,
    pub estimated_vram_gb: f32,
    pub status: String, // "ok", "warning", "exceeds"
    pub is_recommended: bool,
    pub size_gb: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct RecommendedModelCard {
    pub id: String,
    pub name: String,
    pub tagline: String,
    pub description: String,
    pub parameters: String,
    pub recommended_quant: String,
    pub size_gb: f32,
    pub repo_id: String,
    pub filename: String,
    pub tags: Vec<String>,
    pub license_name: String,
    pub is_commercial_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct InstalledModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub full_path: String,
    pub size_bytes: u64,
    pub size_gb: f32,
    pub kind: ModelKind,
    pub state: ModelLifecycleState,
    pub memory_used_mb: Option<u64>,
}
