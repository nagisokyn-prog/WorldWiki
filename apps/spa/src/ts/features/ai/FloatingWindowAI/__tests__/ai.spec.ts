import { describe, it, expect, vi } from 'vitest';

describe('FloatingWindowAI ai.ts entry point', () => {
  it('creates and mounts Vue app with Pinia', async () => {
    const mockApp = {
      use: vi.fn().mockReturnThis(),
      mount: vi.fn(),
    };

    vi.doMock('vue', () => ({
      createApp: vi.fn(() => mockApp),
    }));

    vi.doMock('pinia', () => ({
      createPinia: vi.fn(() => ({})),
    }));

    vi.doMock('../AiApp.vue', () => ({
      default: {},
    }));

    // Import ai.ts
    await import('../ai');

    const { createApp } = await import('vue');
    expect(createApp).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalled();
    expect(mockApp.mount).toHaveBeenCalledWith('#app');
  });
});
