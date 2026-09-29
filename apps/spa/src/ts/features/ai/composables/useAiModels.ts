import { ref } from 'vue';
import type { AiModelInfo } from '../types/ai.types';
import { aiModelsApi } from '../api/aiModels.api';

export function useAiModels() {
  const availableModels = ref<AiModelInfo[]>([]);
  const isFetchingModels = ref(false);
  const fetchError = ref('');

  const getCacheKey = (provider: string) => `ai_models_cache_${provider}`;

  const fetchModels = async (provider: string, apiKey: string, _baseUrl?: string, forceNetwork = true) => {
    fetchError.value = '';

    // 1. For local provider, fetch installed models directly
    if (provider === 'local') {
      try {
        isFetchingModels.value = true;
        const localList = await aiModelsApi.fetchModels('local', '');
        availableModels.value = localList;
        localStorage.setItem(getCacheKey('local'), JSON.stringify(localList));
      } catch (err) {
        console.error('[useAiModels] Failed to load local models:', err);
        fetchError.value = String(err);
      } finally {
        isFetchingModels.value = false;
      }
      return;
    }

    // 2. Load from localStorage cache if available
    const cached = localStorage.getItem(getCacheKey(provider));
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          availableModels.value = parsed;
        }
      } catch (err) {
        console.warn('[useAiModels] Failed to parse cached models from localStorage:', err);
      }
    }

    // 3. Fetch live list dynamically from backend
    isFetchingModels.value = true;
    
    try {
      const res = await aiModelsApi.fetchModels(provider, apiKey);
      if (res && res.length > 0) {
        availableModels.value = res;
        localStorage.setItem(getCacheKey(provider), JSON.stringify(res));
      }
    } catch (err: unknown) {
      console.error('[useAiModels] Fetch models failed:', err);
      if (forceNetwork) {
        fetchError.value = String(err);
      }
    } finally {
      isFetchingModels.value = false;
    }
  };

  return {
    availableModels,
    isFetchingModels,
    fetchError,
    fetchModels
  };
}
