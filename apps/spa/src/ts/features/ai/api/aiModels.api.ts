import { invoke } from '@tauri-apps/api/core';
import type { AiModelInfo, InstalledModelInfo } from '../types/ai.types';

export const aiModelsApi = {
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
    } else {
      return await invoke<AiModelInfo[]>('fetch_ai_models', { provider, apiKey });
    }
  },

  async fetchOpenRouterModels(apiKey: string): Promise<AiModelInfo[]> {
    const headers: Record<string, string> = {
      'HTTP-Referer': 'https://github.com/WorldWiki',
      'X-Title': 'WorldWiki'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} - ${await response.text()}`);
    }
    
    interface OpenRouterModel {
      id: string;
      name?: string;
      context_length?: number;
      top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
      };
      pricing?: {
        prompt?: string | number;
        completion?: string | number;
      };
      architecture?: {
        modality?: string;
        tokenizer?: string;
      };
    }

    const json = await response.json() as { data: OpenRouterModel[] };
    const res: AiModelInfo[] = json.data.map((m) => ({
      value: m.id,
      label: m.id,
      description: m.name || m.id,
      context_length: m.context_length || m.top_provider?.context_length,
      max_completion_tokens: m.top_provider?.max_completion_tokens,
      pricing: m.pricing ? {
        prompt: String(m.pricing.prompt ?? '0'),
        completion: String(m.pricing.completion ?? '0')
      } : undefined,
      capabilities: m.architecture ? {
        vision: m.architecture.modality?.includes('image') || false,
        caching: m.architecture.tokenizer === 'claude' || m.id.includes('claude-3')
      } : undefined
    }));
    
    res.sort((a, b) => a.label.localeCompare(b.label));
    return res;
  }
};
