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

  it('fetches installed models for local provider', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { filename: 'llama3.gguf', name: 'Llama 3', size_gb: 4.5 },
    ]);

    const res = await aiModelsApi.fetchModels('local', '');
    expect(invoke).toHaveBeenCalledWith('list_installed_models');
    expect(res).toEqual([
      {
        value: 'llama3.gguf',
        label: 'llama3.gguf',
        description: 'Llama 3 (4.5 ГБ)',
        context_length: 8192,
        max_completion_tokens: 4096,
      },
    ]);

    // When installed is null (covers line 8 installed || [])
    vi.mocked(invoke).mockResolvedValueOnce(null as any);
    const emptyRes = await aiModelsApi.fetchModels('local', '');
    expect(emptyRes).toEqual([]);
  });

  it('fetches models for openrouter via fetchModels delegation', async () => {
    const mockJson = {
      data: [
        {
          id: 'custom-claude-3-test',
          name: '',
          context_length: 128000,
          architecture: { modality: 'text+image', tokenizer: 'openai' },
          pricing: { prompt: undefined, completion: undefined },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJson),
    });
    globalThis.fetch = fetchMock as any;

    const res = await aiModelsApi.fetchModels('openrouter', 'router-key');
    expect(res.length).toBe(1);
    expect(res[0].description).toBe('custom-claude-3-test');
    expect(res[0].capabilities?.caching).toBe(true);
    expect(res[0].capabilities?.vision).toBe(true);
    expect(res[0].pricing).toEqual({ prompt: '0', completion: '0' });
  });

  it('throws error when OpenRouter response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized access'),
    });
    globalThis.fetch = fetchMock as any;

    await expect(aiModelsApi.fetchOpenRouterModels('bad-key')).rejects.toThrow('OpenRouter API error: 401 - Unauthorized access');
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
