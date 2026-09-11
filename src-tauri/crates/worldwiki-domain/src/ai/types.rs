use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelKind {
    Generation,
    Embedding,
    Reranker,
    Vision,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeKind {
    Cloud,
    LlamaCpp,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionPolicy {
    Direct,
    #[default]
    ToolAssisted,
    Agentic,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionLevel {
    Allow,
    Ask,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    Read,
    Edit,
    Analytics,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPermissionConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: ToolCategory,
    pub risk: RiskLevel,
    pub default_level: PermissionLevel,
    pub user_level: Option<PermissionLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelLifecycleState {
    Installed,
    Loading,
    Ready,
    Busy,
    Idle,
    Sleeping,
    Unloading,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub total_ram_gb: f32,
    pub free_ram_gb: f32,
    pub gpu_name: String,
    pub total_vram_gb: f32,
    pub free_vram_gb: f32,
    pub is_gpu_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEstimation {
    pub quant_name: String,
    pub estimated_vram_gb: f32,
    pub status: String,
    pub is_recommended: bool,
    pub size_gb: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfModelCard {
    pub id: String,
    pub author: Option<String>,
    pub name: String,
    pub downloads: u64,
    pub likes: u64,
    pub tags: Vec<String>,
    pub gguf_files: Vec<GgufFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GgufFileInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub size_gb: f32,
    pub quantization: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub repo_id: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub is_done: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub is_done: bool,
    pub chunk_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolEvent {
    pub chat_id: String,
    pub message_id: String,
    pub tool_name: String,
    pub tool_args: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMatch {
    pub id: String,
    pub name: String,
    pub description: String,
    pub prompt_text: String,
    pub file_path: Option<String>,
    pub matched_via: String, // "exact_trigger" | "bm25" | "vector" | "manual"
    pub score: f32,
}


