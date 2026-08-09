import { invoke } from '@tauri-apps/api/core';
import type { AiModelInfo } from '../types/ai.types';

export const aiModelsApi = {
  async fetchModels(provider: string, apiKey: string): Promise<AiModelInfo[]> {
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
    
    const json = await response.json();
    const res: AiModelInfo[] = json.data.map((m: any) => ({
      value: m.id,
      label: m.id,
      description: m.name,
      context_length: m.context_length || m.top_provider?.context_length,
      max_completion_tokens: m.top_provider?.max_completion_tokens,
      pricing: m.pricing ? {
        prompt: m.pricing.prompt,
        completion: m.pricing.completion
      } : undefined,
      capabilities: m.architecture ? {
        vision: m.architecture.modality?.includes('image') || false,
        caching: m.architecture.tokenizer === 'claude' || m.id.includes('claude-3') // Simple heuristic for now
      } : undefined
    }));
    
    res.sort((a, b) => a.label.localeCompare(b.label));
    return res;
  }
};
