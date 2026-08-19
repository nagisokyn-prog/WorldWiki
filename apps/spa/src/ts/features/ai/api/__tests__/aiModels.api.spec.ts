import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiModelsApi } from '../aiModels.api';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('aiModelsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches models via tauri invoke for non-openrouter providers', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([{ value: 'm1', label: 'Model 1' }]);

    const res = await aiModelsApi.fetchModels('openai', 'key123');
    expect(invoke).toHaveBeenCalledWith('fetch_ai_models', { provider: 'openai', apiKey: 'key123' });
    expect(res).toEqual([{ value: 'm1', label: 'Model 1' }]);
  });

  it('fetches models for openrouter via fetch', async () => {
    const mockJson = {
      data: [
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          context_length: 128000,
          architecture: { modality: 'text+image', tokenizer: 'openai' },
          pricing: { prompt: '0.005', completion: '0.015' },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJson),
    });
    globalThis.fetch = fetchMock as any;

    const res = await aiModelsApi.fetchOpenRouterModels('my-key');
    expect(fetchMock).toHaveBeenCalled();
    expect(res.length).toBe(1);
    expect(res[0].value).toBe('openai/gpt-4o');
    expect(res[0].capabilities?.vision).toBe(true);
  });

  it('throws error if openrouter fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });
    globalThis.fetch = fetchMock as any;

    await expect(aiModelsApi.fetchOpenRouterModels('bad-key')).rejects.toThrow('OpenRouter API error: 401 - Unauthorized');
  });
});
