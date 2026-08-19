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
});
