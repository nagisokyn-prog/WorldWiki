import { describe, it, expect, vi } from 'vitest';

describe('FloatingWindowAI ai.ts entry point', () => {
  it('creates and mounts Vue app with Pinia', async () => {
    const mockApp = {
      use: vi.fn().mockReturnThis(),
      mount: vi.fn(),
    };

    vi.doMock('vue', async (importOriginal) => {
      const actual = await importOriginal<typeof import('vue')>();
      return {
        ...actual,
        createApp: vi.fn(() => mockApp),
      };
    });

    vi.doMock('pinia', () => ({
      createPinia: vi.fn(() => ({})),
    }));

    vi.doMock('../AiApp.vue', () => ({
      default: {},
    }));

    // Import ai.ts
    await import('../ai');
    await new Promise((r) => setTimeout(r, 20));

    const { createApp } = await import('vue');
    expect(createApp).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalled();
    expect(mockApp.mount).toHaveBeenCalledWith('#app');
  });
});
