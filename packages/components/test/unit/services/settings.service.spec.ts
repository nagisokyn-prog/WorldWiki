// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { settingsService } from '../../../src/ts/services/settings.service';

describe('settings.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as any).__TAURI__;
    delete (window as any).__APP_CONFIG__;
    settingsService.saveSettings = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('switchTheme - dark theme with Tauri', () => {
    it('loads theme via Tauri and merges when themeSettings returned', async () => {
      (window as any).__TAURI__ = {
        core: {
          invoke: vi.fn().mockResolvedValue({ colors: { accent: '#ff0000' } }),
        },
      };

      await settingsService.switchTheme('dark');

      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('load_theme', { theme: 'dark' });
      expect(settingsService.getSettings().colors.accent).toBe('#ff0000');
    });

    it('falls back to default settings when Tauri returns null for dark theme', async () => {
      (window as any).__TAURI__ = {
        core: {
          invoke: vi.fn().mockResolvedValue(null),
        },
      };

      await settingsService.switchTheme('dark');

      const settings = settingsService.getSettings();
      expect(settings.colors.bgBase).toBe('#09090b'); // DEFAULT_SETTINGS
    });

    it('falls back to default settings when Tauri throws for dark theme', async () => {
      (window as any).__TAURI__ = {
        core: {
          invoke: vi.fn().mockRejectedValue(new Error('Tauri error')),
        },
      };
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await settingsService.switchTheme('dark');

      const settings = settingsService.getSettings();
      expect(settings.colors.bgBase).toBe('#09090b');
      expect(warnSpy).toHaveBeenCalledWith('Tauri theme load failed for dark:', expect.any(Error));
      warnSpy.mockRestore();
    });

    it('uses localStorage fallback when no Tauri for dark theme', async () => {
      delete (window as any).__TAURI__;
      localStorage.setItem('app:theme:dark', JSON.stringify({ colors: { accent: '#00ff00' } }));

      await settingsService.switchTheme('dark');

      expect(settingsService.getSettings().colors.accent).toBe('#00ff00');
    });

    it('catches localStorage error and warns', async () => {
      delete (window as any).__TAURI__;
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn().mockImplementation(() => { throw new Error('localStorage error'); });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await settingsService.switchTheme('dark');

      expect(warnSpy).toHaveBeenCalledWith('localStorage theme load failed for dark:', expect.any(Error));
      localStorage.getItem = originalGetItem;
      warnSpy.mockRestore();
    });

    it('does nothing for light theme when no Tauri and no localStorage', async () => {
      delete (window as any).__TAURI__;
      localStorage.clear();

      await settingsService.switchTheme('light');

      // Should not throw, just saveSettings called
      expect(settingsService.saveSettings).toHaveBeenCalled();
    });
  });

  describe('loadSettings / saveSettings', () => {
    it('loadSettings uses localStorage when no Tauri', async () => {
      delete (window as any).__TAURI__;
      localStorage.setItem('app:settings', JSON.stringify({ colors: { accent: '#123456' } }));

      await settingsService.loadSettings();

      expect(settingsService.getSettings().colors.accent).toBe('#123456');
    });

    it('loadSettings handles localStorage parse error', async () => {
      delete (window as any).__TAURI__;
      localStorage.setItem('app:settings', 'invalid json');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await settingsService.loadSettings();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('saveSettings writes to localStorage', async () => {
      delete (window as any).__TAURI__;
      settingsService.getSettings().colors.accent = '#abcdef';

      await settingsService.saveSettings();

      const saved = JSON.parse(localStorage.getItem('app:settings')!);
      expect(saved.colors.accent).toBe('#abcdef');
    });
  });

  describe('applySettings', () => {
    it('applies CSS variables to document.documentElement', () => {
      settingsService.applySettings();
      const style = getComputedStyle(document.documentElement);
      expect(style.getPropertyValue('--bg-base')).toBeTruthy();
    });
  });

  describe('onChange listener', () => {
    it('notifies listeners on settings change', () => {
      const listener = vi.fn();
      settingsService.onChange(listener);
      settingsService.getSettings().colors.accent = '#newcolor';
      settingsService.saveSettings();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('window storage event & additional branches', () => {
    it('handles window storage event with matching key and valid JSON', () => {
      const listener = vi.fn();
      settingsService.onChange(listener);

      const event = new StorageEvent('storage', {
        key: 'app:settings',
        newValue: JSON.stringify({ colors: { accent: '#778899' } }),
      });
      window.dispatchEvent(event);

      expect(settingsService.getSettings().colors.accent).toBe('#778899');
      expect(listener).toHaveBeenCalled();
    });

    it('handles window storage event with invalid JSON or mismatched key gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mismatched key
      window.dispatchEvent(new StorageEvent('storage', { key: 'other:key', newValue: '{}' }));

      // Invalid JSON
      window.dispatchEvent(new StorageEvent('storage', { key: 'app:settings', newValue: 'invalid{json' }));
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('handles switchTheme for light theme with Tauri failure and null response', async () => {
      (window as any).__TAURI__ = {
        core: {
          invoke: vi.fn().mockResolvedValue(null),
        },
      };

      // 1. null response for light theme
      await settingsService.switchTheme('light');
      expect(settingsService.saveSettings).toHaveBeenCalled();

      // 2. rejected response for light theme
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('Tauri failed'));
      await settingsService.switchTheme('light');
      expect(settingsService.saveSettings).toHaveBeenCalled();
    });

    it('handles localStorage throw in switchTheme', async () => {
      delete (window as any).__TAURI__;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const origGetItem = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('Storage disabled'); };

      await settingsService.switchTheme('light');
      expect(warnSpy).toHaveBeenCalledWith('localStorage theme load failed for light:', expect.any(Error));

      localStorage.getItem = origGetItem;
      warnSpy.mockRestore();
    });

    it('handles applyQualityLevel scaling', () => {
      settingsService.applyQualityLevel(80);
      expect(settingsService.getSettings().perf.qualityLevel).toBe(80);
      settingsService.applyQualityLevel(0);
      expect(settingsService.getSettings().perf.qualityLevel).toBe(0);
    });
  });
});