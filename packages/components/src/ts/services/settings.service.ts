/**
 * @file settings.service.ts
 * @description Сервис для управления настройками приложения
 * @rust-ready ✅ loadSettings, saveSettings, calculateLoadMeter, autoDetectFPS
 */

import { onScopeDispose } from 'vue';
import { setLocale } from '../i18n';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from './settings.defaults';
import { applySettingsToDOM } from './settings.dom';
import { applyCustomBackground } from './settings.background';

export { DEFAULT_SETTINGS };

class SettingsService {
  private settings: AppSettings;
  private listeners: ((settings: AppSettings) => void)[] = [];
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private tauriUnlisten: (() => void) | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    if (typeof window !== 'undefined') {
      // Синхронизация между вкладками браузера
      this.storageListener = (e: StorageEvent) => {
        if (e.key === (window.__APP_CONFIG__?.storageKey ?? 'app:settings') && e.newValue) {
          try {
            const newSettings = JSON.parse(e.newValue);
            this.settings = this.deepMerge(this.settings, newSettings);
            this.applySettings();
            this.notifyListeners();
          } catch (err) {
            console.error('Failed to sync settings from storage', err);
          }
        }
      };
      window.addEventListener('storage', this.storageListener);

      // Синхронизация между окнами Tauri
      if (window.__TAURI__?.event) {
        window.__TAURI__.event.listen('settings-updated', (event: { payload: AppSettings }) => {
          if (event.payload) {
            this.settings = this.deepMerge(DEFAULT_SETTINGS, event.payload);
            this.applySettings();
            this.applyLocale();
            this.notifyListeners();
          }
        }).then(
          (unlisten) => { this.tauriUnlisten = unlisten; },
          (e: unknown) => console.warn('Failed to listen to settings-updated', e)
        );
      }
    }
  }

  /**
   * Загружает настройки из Tauri или localStorage
   */
  async loadSettings(): Promise<AppSettings> {
    console.log('[settingsService] loading settings...');
    if (window.__TAURI__?.core) {
      try {
        const saved = await window.__TAURI__.core.invoke<AppSettings | null>('load_settings');
        if (saved) {
          console.log('[settingsService] loaded from Tauri');
          this.settings = this.deepMerge(DEFAULT_SETTINGS, saved);
          this.applySettings();
          this.applyLocale();
          return this.settings;
        }
      } catch (e) {
        console.warn('Tauri settings load failed, falling back to localStorage:', e);
      }
    }

    try {
      const saved = localStorage.getItem(window.__APP_CONFIG__?.storageKey ?? 'app:settings');
      if (saved) {
        console.log('[settingsService] loaded from localStorage');
        this.settings = this.deepMerge(DEFAULT_SETTINGS, JSON.parse(saved));
        this.applySettings();
        this.applyLocale();
      } else {
        console.log('[settingsService] no saved settings found, using defaults');
      }
    } catch (e) {
      console.warn('localStorage load failed:', e);
    }

    return this.settings;
  }

  /**
   * Сохраняет настройки в Tauri и localStorage
   */
  async saveSettings(settings: Partial<AppSettings> | null = null, immediate = false): Promise<void> {
    if (settings) {
      this.settings = this.deepMerge(this.settings, JSON.parse(JSON.stringify(settings)));
    }

    this.applySettings();
    this.applyLocale();
    this.notifyListeners();

    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    const persist = async () => {
      console.log('[settingsService] saving settings to backend:', JSON.stringify(this.settings).substring(0, 100));

      if (window.__TAURI__?.core) {
        try {
          await window.__TAURI__.core.invoke('save_settings', { settings: this.settings });
          if (window.__TAURI__.event) {
            await window.__TAURI__.event.emit('settings-updated', this.settings);
          }
        } catch (e) {
          console.warn('Tauri settings save failed:', e);
        }
      }

      try {
        localStorage.setItem(window.__APP_CONFIG__?.storageKey ?? 'app:settings', JSON.stringify(this.settings));
      } catch (e) {
        console.warn('localStorage save failed:', e);
      }
    };

    if (immediate) {
      await persist();
    } else {
      this.saveTimeout = setTimeout(() => { void persist(); }, 300);
    }
  }

  getDefaultSettings(): AppSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  resetSettings(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  private applyLocale(): void {
    const locale = (this.settings as AppSettings & { locale?: 'ru' | 'en' }).locale || 'ru';
    setLocale(locale as 'ru' | 'en');
  }

  applyQualityLevel(level: number): void {
    this.settings.perf.qualityLevel = level;
    const ratio = Math.max(0, Math.min(100, level)) / 100;

    this.settings.glass.blur = Math.round(24 * ratio);
    this.settings.animations.enabled = level >= 20;
    this.settings.animations.pulse = level >= 50;
    this.settings.animations.speed = +(0.6 - (0.3 * ratio)).toFixed(2);
    this.settings.shadows.islandBlur = Math.round(25 * ratio);
    this.settings.shadows.islandY = Math.round(12 * ratio);
    this.settings.shadows.useInset = level >= 40;
    this.settings.glass.islandAlpha = +(0.60 * ratio).toFixed(2);
    this.settings.glass.cardAlpha = +(0.60 * ratio).toFixed(2);

    this.saveSettings();
  }

  applyBackground(): void {
    applyCustomBackground(this.settings);
  }

  applySettings(): void {
    applySettingsToDOM(this.settings);
  }

  async switchTheme(themeName: 'dark' | 'light'): Promise<void> {
    console.log(`[settingsService] switching to ${themeName} theme`);

    if (window.__TAURI__?.core) {
      try {
        const themeSettings = await window.__TAURI__.core.invoke<AppSettings>(
          'load_theme',
          { theme: themeName }
        );
        if (themeSettings) {
          this.settings = this.deepMerge(this.settings, themeSettings);
        }
      } catch (e) {
        console.warn(`Tauri theme load failed for ${themeName}:`, e);
      }
    }

    try {
      const themeKey = `${window.__APP_CONFIG__?.id ?? "app"}:theme:${themeName}`;
      const saved = localStorage.getItem(themeKey);
      if (saved) {
        const themeSettings = JSON.parse(saved) as Partial<AppSettings>;
        this.settings = this.deepMerge(this.settings, themeSettings);
      }
    } catch (e) {
      console.warn(`localStorage theme load failed for ${themeName}:`, e);
    }

    await this.saveSettings(this.settings, true);
  }

  getCurrentTheme(): 'dark' | 'light' {
    return (this.settings as unknown as { theme?: 'dark' | 'light' }).theme || 'dark';
  }

  private deepMerge(target: AppSettings, source: Partial<AppSettings>): AppSettings {
    const result = { ...target } as unknown as Record<string, unknown>;
    const sourceObj = source as unknown as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      const sourceValue = sourceObj[key];
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        result[key] = this.deepMerge(
          result[key] as AppSettings,
          sourceValue as Partial<AppSettings>
        ) as unknown;
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
    return result as unknown as AppSettings;
  }

  onChange(listener: (settings: AppSettings) => void): () => void {
    this.listeners.push(listener);
    return () => this.offChange(listener);
  }

  offChange(listener: (settings: AppSettings) => void): void {
    this.listeners = this.listeners.filter(fn => fn !== listener);
  }

  dispose(): void {
    if (typeof window !== 'undefined' && this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
    if (this.tauriUnlisten) {
      this.tauriUnlisten();
      this.tauriUnlisten = null;
    }
    this.listeners = [];
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => fn(this.settings));
  }
}

export const settingsService = new SettingsService();

export function useSettingsService(): SettingsService {
  onScopeDispose(() => {});
  return settingsService;
}

declare global {
  interface Window {
    settingsService: SettingsService;
  }
}

if (typeof window !== 'undefined') {
  window.settingsService = settingsService;
}
