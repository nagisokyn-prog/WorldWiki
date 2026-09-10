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
    return await invoke<AiModelInfo[]>('fetch_ai_models', { provider, apiKey: apiKey || null });
  }
};
