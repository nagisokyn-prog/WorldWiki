import { ref } from 'vue';
import type { AiModelInfo } from '../types/ai.types';
import { aiModelsApi } from '../api/aiModels.api';

// Hardcode fallbacks for providers that don't easily serve /models directly via CORS
const hardcodedModels: Record<string, AiModelInfo[]> = {
  'anthropic': [
    { value: 'claude-3-7-sonnet-20250219', label: 'claude-3-7-sonnet-20250219', description: 'Claude 3.7 Sonnet', context_length: 200000, max_completion_tokens: 8192, capabilities: { vision: true } },
    { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet-20241022', description: 'Claude 3.5 Sonnet', context_length: 200000, max_completion_tokens: 8192, capabilities: { vision: true } },
    { value: 'claude-3-opus-20240229', label: 'claude-3-opus-20240229', description: 'Claude 3 Opus', context_length: 200000, max_completion_tokens: 4096, capabilities: { vision: true } }
  ],
  'openai': [
    { value: 'gpt-4o', label: 'gpt-4o', description: 'GPT-4o', context_length: 128000, max_completion_tokens: 4096, capabilities: { vision: true } },
    { value: 'o3-mini', label: 'o3-mini', description: 'o3-mini', context_length: 200000, max_completion_tokens: 100000 }
  ],
  'gemini': [
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro', description: 'Gemini 1.5 Pro', context_length: 2097152, max_completion_tokens: 8192, capabilities: { vision: true } },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash', description: 'Gemini 1.5 Flash', context_length: 1048576, max_completion_tokens: 8192, capabilities: { vision: true } }
  ],
  'openrouter': []
};

export function useAiModels() {
  const availableModels = ref<AiModelInfo[]>([]);
  const isFetchingModels = ref(false);
  const fetchError = ref('');

  const getCacheKey = (provider: string) => `ai_models_cache_${provider}`;

  const fetchModels = async (provider: string, apiKey: string, baseUrl?: string, forceNetwork = false) => {
    fetchError.value = '';

    // 1. Load from cache or hardcode immediately for UX
    const cached = localStorage.getItem(getCacheKey(provider));
    if (cached) {
      try {
        availableModels.value = JSON.parse(cached);
      } catch {
        // ignore
      }
    } else if (hardcodedModels[provider]) {
      availableModels.value = hardcodedModels[provider];
    } else {
      availableModels.value = [];
    }

    // 2. Fetch in background (or foreground if forced)
    if (provider === 'local' && !baseUrl) return; // Need url for local
    
    if (forceNetwork) isFetchingModels.value = true;
    
    try {
      const res = await aiModelsApi.fetchModels(provider, apiKey);
      
      if (res && res.length > 0) {
        availableModels.value = res;
        localStorage.setItem(getCacheKey(provider), JSON.stringify(res));
      }
    } catch (err: any) {
      console.warn('Background fetch models failed:', err);
      if (forceNetwork) {
        fetchError.value = err.toString();
      }
    } finally {
      if (forceNetwork) isFetchingModels.value = false;
    }
  };

  return {
    availableModels,
    isFetchingModels,
    fetchError,
    fetchModels
  };
}
