import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiModels } from '../useAiModels';
import { aiModelsApi } from '../../api/aiModels.api';

vi.mock('../../api/aiModels.api', () => ({
  aiModelsApi: {
    fetchModels: vi.fn(),
  },
}));

describe('useAiModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads hardcoded models on initial fetch and then updates from API', async () => {
    const apiModels = [{ value: 'gpt-4o', label: 'GPT 4o' }];
    vi.mocked(aiModelsApi.fetchModels).mockResolvedValueOnce(apiModels as any);

    const composable = useAiModels();
    await composable.fetchModels('openai', 'key123', undefined, true);

    expect(composable.availableModels.value).toEqual(apiModels);
    expect(localStorage.getItem('ai_models_cache_openai')).toContain('gpt-4o');
  });

  it('uses cached models if available', async () => {
    localStorage.setItem('ai_models_cache_anthropic', JSON.stringify([{ value: 'cached-claude', label: 'Cached' }]));

    const composable = useAiModels();
    await composable.fetchModels('anthropic', 'key123');

    expect(composable.availableModels.value[0].value).toBe('cached-claude');
  });

  it('handles fetch error when forced', async () => {
    vi.mocked(aiModelsApi.fetchModels).mockRejectedValueOnce(new Error('Network error'));

    const composable = useAiModels();
    await composable.fetchModels('openai', 'key123', undefined, true);

    expect(composable.fetchError.value).toContain('Network error');
  });

  it('handles corrupt cached JSON gracefully', async () => {
    localStorage.setItem('ai_models_cache_openai', 'invalid json {{{');

    const composable = useAiModels();
    await composable.fetchModels('openai', 'key123');
    // Corrupt JSON ignored, fallback to hardcoded
    expect(composable.availableModels.value.length).toBeGreaterThan(0);
  });

  it('handles unknown provider with empty fallback', async () => {
    const composable = useAiModels();
    await composable.fetchModels('unknown_provider_xyz', 'key123');
    expect(composable.availableModels.value).toEqual([]);
  });

  it('handles local provider with and without baseUrl', async () => {
    const composable = useAiModels();

    // Without baseUrl -> returns early
    await composable.fetchModels('local', 'key123');
    expect(aiModelsApi.fetchModels).not.toHaveBeenCalled();

    // With baseUrl
    vi.mocked(aiModelsApi.fetchModels).mockResolvedValueOnce([]);
    await composable.fetchModels('local', 'key123', 'http://localhost:11434');
    expect(aiModelsApi.fetchModels).toHaveBeenCalledWith('local', 'key123');
  });

  it('handles unforced network errors without setting fetchError', async () => {
    vi.mocked(aiModelsApi.fetchModels).mockRejectedValueOnce(new Error('Background error'));

    const composable = useAiModels();
    await composable.fetchModels('openai', 'key123', undefined, false);

    expect(composable.fetchError.value).toBe('');
  });
});
