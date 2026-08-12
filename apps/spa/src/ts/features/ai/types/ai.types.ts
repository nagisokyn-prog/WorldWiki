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
  reasoning_effort?: string;
  timeout_mins?: number;
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
  value: string;         // e.g. "nvidia/nemotron-3-ultra-550b-a55b:free"
  label: string;         // Same as value, displayed in dropdown
  description: string;   // Pretty name, e.g. "NVIDIA Nemotron 3 Ultra 550b"
  context_length?: number;
  max_completion_tokens?: number;
  capabilities?: AiModelCapabilities;
  pricing?: AiModelPricing;
}
