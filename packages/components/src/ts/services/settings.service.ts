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
import { deepMergeSettings, loadThemeSettings } from './settings.theme';
import { loadAppSettingsFromStorage, persistAppSettings, computeQualitySettings } from './settings.persistence';

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
      this.storageListener = (e: StorageEvent) => {
        if (e.key === (window.__APP_CONFIG__?.storageKey ?? 'app:settings') && e.newValue) {
          try {
            const newSettings = JSON.parse(e.newValue);
            this.settings = deepMergeSettings(this.settings, newSettings);
            this.applySettings();
            this.notifyListeners();
          } catch (err) {
            console.error('Failed to sync settings from storage', err);
          }
        }
      };
      window.addEventListener('storage', this.storageListener);

      if (window.__TAURI__?.event) {
        window.__TAURI__.event.listen('settings-updated', (event: { payload: AppSettings }) => {
          if (event.payload) {
            this.settings = deepMergeSettings(DEFAULT_SETTINGS, event.payload);
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

  async loadSettings(): Promise<AppSettings> {
    this.settings = await loadAppSettingsFromStorage();
    this.applySettings();
    this.applyLocale();
    return this.settings;
  }

  async saveSettings(settings: Partial<AppSettings> | null = null, immediate = false): Promise<void> {
    if (settings) {
      this.settings = deepMergeSettings(this.settings, JSON.parse(JSON.stringify(settings)));
    }

    this.applySettings();
    this.applyLocale();
    this.notifyListeners();

    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    const persist = async () => {
      await persistAppSettings(this.settings);
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
    computeQualitySettings(level, this.settings);
    this.saveSettings();
  }

  applyBackground(): void {
    applyCustomBackground(this.settings);
  }

  applySettings(): void {
    applySettingsToDOM(this.settings);
  }

  async switchTheme(themeName: 'dark' | 'light'): Promise<void> {
    const themeSettings = await loadThemeSettings(themeName);
    if (themeSettings) {
      this.settings = deepMergeSettings(this.settings, themeSettings);
    }
    await this.saveSettings(this.settings, true);
  }

  getCurrentTheme(): 'dark' | 'light' {
    return (this.settings as unknown as { theme?: 'dark' | 'light' }).theme || 'dark';
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
