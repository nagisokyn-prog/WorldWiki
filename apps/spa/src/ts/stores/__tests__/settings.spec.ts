import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '../settings';
import { settingsService } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: vi.fn().mockReturnValue({ theme: 'dark', fontSize: 14 }),
    saveSettings: vi.fn(),
    loadSettings: vi.fn().mockResolvedValue({ theme: 'dark' }),
    applySettings: vi.fn(),
  },
}));

describe('settings store', () => {
  let store: ReturnType<typeof useSettingsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useSettingsStore();
  });

  it('delegates calls to settingsService', async () => {
    expect(store.getSettings()).toEqual({ theme: 'dark', fontSize: 14 });
    expect(store.settings).toEqual({ theme: 'dark', fontSize: 14 });

    store.setSettings({ theme: 'light' });
    expect(settingsService.saveSettings).toHaveBeenCalledWith({ theme: 'light' });

    await store.loadSettings();
    expect(settingsService.loadSettings).toHaveBeenCalled();

    store.applySettings();
    expect(settingsService.applySettings).toHaveBeenCalled();
  });
});
