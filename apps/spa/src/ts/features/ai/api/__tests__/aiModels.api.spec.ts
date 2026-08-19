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

  it('handles empty apiKey, top_provider fallbacks, claude caching, and missing pricing/architecture', async () => {
    const mockJson = {
      data: [
        {
          id: 'anthropic/claude-3-opus',
          name: 'Claude 3 Opus',
          top_provider: { context_length: 200000, max_completion_tokens: 4096 },
          architecture: { modality: 'text', tokenizer: 'claude' },
        },
        {
          id: 'simple/model',
          name: 'Simple Model',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJson),
    });
    globalThis.fetch = fetchMock as any;

    // Fetch without apiKey
    const res = await aiModelsApi.fetchOpenRouterModels('');
    expect(res.length).toBe(2);

    const claude = res.find(m => m.value === 'anthropic/claude-3-opus');
    expect(claude?.context_length).toBe(200000);
    expect(claude?.capabilities?.caching).toBe(true);

    const simple = res.find(m => m.value === 'simple/model');
    expect(simple?.pricing).toBeUndefined();
    expect(simple?.capabilities).toBeUndefined();
  });
});

