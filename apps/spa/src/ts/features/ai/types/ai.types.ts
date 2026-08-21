export type ModelKind = 'generation' | 'embedding' | 'reranker' | 'vision';
export type RuntimeKind = 'cloud' | 'llama_cpp' | 'ollama';
export type ExecutionPolicy = 'direct' | 'tool_assisted' | 'agentic';
export type PermissionLevel = 'allow' | 'ask' | 'deny';
export type ToolCategory = 'read' | 'edit' | 'analytics' | 'system';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ModelLifecycleState = 'installed' | 'loading' | 'ready' | 'busy' | 'idle' | 'sleeping' | 'unloading' | 'error';

export interface ToolPermissionConfig {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  risk: RiskLevel;
  default_level: PermissionLevel;
  user_level?: PermissionLevel;
}

export interface HardwareInfo {
  total_ram_gb: number;
  free_ram_gb: number;
  gpu_name: string;
  total_vram_gb: number;
  free_vram_gb: number;
  is_gpu_available: boolean;
}

export interface MemoryEstimation {
  quant_name: string;
  estimated_vram_gb: number;
  status: string; // 'ok' | 'warning' | 'exceeds'
  is_recommended: boolean;
  size_gb: number;
}

export interface RecommendedModelCard {
  id: string;
  name: string;
  tagline: string;
  description: string;
  parameters: string;
  recommended_quant: string;
  size_gb: number;
  repo_id: string;
  filename: string;
  tags: string[];
  license_name: string;
  is_commercial_allowed: boolean;
}

export interface InstalledModelInfo {
  id: string;
  name: string;
  filename: string;
  full_path: string;
  size_bytes: number;
  size_gb: number;
  kind: ModelKind;
  state: ModelLifecycleState;
  memory_used_mb?: number;
}

export interface AiProfileSettings {
  model: string;
  temperature: number;
  use_custom_temperature?: boolean;
  max_tokens?: number;
  context_window?: number;
  thinking_budget?: number;
  custom_instructions?: string;
  rate_limit_ms?: number;
  error_retry_limit?: number;
  enable_task_list?: boolean;
  enable_auto_rag?: boolean;
  enable_semantic_search?: boolean;
  reasoning_effort?: string;
  timeout_mins?: number;
  execution_policy?: ExecutionPolicy;
  
  // Local LLM / llama.cpp settings
  n_ctx?: number;
  n_gpu_layers?: number;
  enable_tcq?: boolean;
  enable_swa?: boolean;
  swa_window?: number;
  triattention_path?: string;
  draft_model_path?: string;
  embed_model_path?: string;
  auto_checkpoint?: boolean;
}

export interface AiProfile {
  id?: string;
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  settings: AiProfileSettings;
  is_active: boolean;
  is_global: boolean;
  project_id?: string;
}

export interface AiModelCapabilities {
  vision?: boolean;
  caching?: boolean;
}

export interface AiModelPricing {
  prompt: string;
  completion: string;
}

export interface AiModelInfo {
  value: string;
  label: string;
  description: string;
  context_length?: number;
  max_completion_tokens?: number;
  capabilities?: AiModelCapabilities;
  pricing?: AiModelPricing;
}
