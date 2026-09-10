import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiModels } from './useAiModels';
import { aiModelsApi } from '../api/aiModels.api';

describe('useAiModels', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('fetches models successfully and updates availableModels & localStorage', async () => {
    const mockModels = [
      { value: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
      { value: 'openai/gpt-4o', label: 'GPT-4o' }
    ];
    vi.spyOn(aiModelsApi, 'fetchModels').mockResolvedValueOnce(mockModels);

    const { availableModels, isFetchingModels, fetchError, fetchModels } = useAiModels();

    await fetchModels('openrouter', 'test-api-key');

    expect(availableModels.value).toEqual(mockModels);
    expect(isFetchingModels.value).toBe(false);
    expect(fetchError.value).toBe('');
    expect(localStorage.getItem('ai_models_cache_openrouter')).toBe(JSON.stringify(mockModels));
  });

  it('handles fetch error and sets fetchError without fake fallback data', async () => {
    vi.spyOn(aiModelsApi, 'fetchModels').mockRejectedValueOnce(new Error('Network connection closed'));

    const { availableModels, fetchError, fetchModels } = useAiModels();

    await fetchModels('openrouter', 'bad-key');

    expect(availableModels.value).toEqual([]);
    expect(fetchError.value).toContain('Network connection closed');
  });

  it('loads cached models from localStorage immediately', async () => {
    const cached = [{ value: 'cached-model', label: 'Cached Model' }];
    localStorage.setItem('ai_models_cache_openai', JSON.stringify(cached));

    vi.spyOn(aiModelsApi, 'fetchModels').mockResolvedValueOnce(cached);

    const { availableModels, fetchModels } = useAiModels();

    await fetchModels('openai', 'key');
    expect(availableModels.value).toEqual(cached);
  });
});
