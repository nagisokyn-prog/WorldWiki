/**
 * @file settings.persistence.ts
 * @description Логика сохранения и загрузки настроек через Tauri / localStorage
 */

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from './settings.defaults';
import { deepMergeSettings } from './settings.theme';

export async function loadAppSettingsFromStorage(): Promise<AppSettings> {
  if (typeof window !== 'undefined' && window.__TAURI__?.core) {
    try {
      const saved = await window.__TAURI__.core.invoke<AppSettings | null>('load_settings');
      if (saved) {
        return deepMergeSettings(DEFAULT_SETTINGS, saved);
      }
    } catch (e) {
      console.warn('Tauri settings load failed, falling back to localStorage:', e);
    }
  }

  try {
    const key = typeof window !== 'undefined' ? (window.__APP_CONFIG__?.storageKey ?? 'app:settings') : 'app:settings';
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (saved) {
      return deepMergeSettings(DEFAULT_SETTINGS, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('localStorage load failed:', e);
  }

  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export async function persistAppSettings(settings: AppSettings): Promise<void> {
  if (typeof window !== 'undefined' && window.__TAURI__?.core) {
    try {
      await window.__TAURI__.core.invoke('save_settings', { settings });
      if (window.__TAURI__.event) {
        await window.__TAURI__.event.emit('settings-updated', settings);
      }
    } catch (e) {
      console.warn('Tauri settings save failed:', e);
    }
  }

  try {
    const key = typeof window !== 'undefined' ? (window.__APP_CONFIG__?.storageKey ?? 'app:settings') : 'app:settings';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

export function computeQualitySettings(level: number, settings: AppSettings): void {
  settings.perf.qualityLevel = level;
  const ratio = Math.max(0, Math.min(100, level)) / 100;

  settings.glass.blur = Math.round(24 * ratio);
  settings.animations.enabled = level >= 20;
  settings.animations.pulse = level >= 50;
  settings.animations.speed = +(0.6 - 0.3 * ratio).toFixed(2);
  settings.shadows.islandBlur = Math.round(25 * ratio);
  settings.shadows.islandY = Math.round(12 * ratio);
  settings.shadows.useInset = level >= 40;
  settings.glass.islandAlpha = +(0.6 * ratio).toFixed(2);
  settings.glass.cardAlpha = +(0.6 * ratio).toFixed(2);
}
