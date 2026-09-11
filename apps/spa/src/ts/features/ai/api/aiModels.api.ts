import { invoke } from '@tauri-apps/api/core';
import type { AiModelInfo, InstalledModelInfo } from '../types/ai.types';

export interface OpenRouterModelRaw {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export const aiModelsApi = {
  async fetchOpenRouterModels(apiKey?: string): Promise<AiModelInfo[]> {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
    }
    const json = (await response.json()) as { data: OpenRouterModelRaw[] };
    return (json.data || []).map((m) => {
      const isClaude = m.id.toLowerCase().includes('claude');
      const isVision = Boolean(m.architecture?.modality?.includes('image'));
      const hasCaching = isClaude;
      const capabilities = (isVision || hasCaching)
        ? { vision: isVision, caching: hasCaching }
        : undefined;

      const pricing = m.pricing
        ? {
            prompt: m.pricing.prompt ?? '0',
            completion: m.pricing.completion ?? '0'
          }
        : undefined;

      return {
        value: m.id,
        label: m.name || m.id,
        description: m.description || m.id,
        context_length: m.top_provider?.context_length ?? m.context_length ?? 4096,
        max_completion_tokens: m.top_provider?.max_completion_tokens ?? 4096,
        pricing,
        capabilities
      };
    });
  },

  async fetchModels(provider: string, apiKey: string): Promise<AiModelInfo[]> {
    if (provider === 'local') {
      const installed = await invoke<InstalledModelInfo[]>('list_installed_models');
      return (installed || []).map(m => ({
        value: m.filename,
        label: m.filename,
        description: `${m.name} (${m.size_gb} ГБ)`,
        context_length: 8192,
        max_completion_tokens: 4096,
      }));
    }
    if (provider === 'openrouter') {
      return await this.fetchOpenRouterModels(apiKey);
    }
    return await invoke<AiModelInfo[]>('fetch_ai_models', { provider, apiKey: apiKey || null });
  }
};
