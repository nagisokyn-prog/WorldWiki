/**
 * @file settings.theme.ts
 * @description Управление темами оформления (dark / light) и глубокое слияние объектов настроек
 */

import type { AppSettings } from '../types/settings';

export function deepMergeSettings(target: AppSettings, source: Partial<AppSettings>): AppSettings {
  const result = { ...target } as unknown as Record<string, unknown>;
  const sourceObj = source as unknown as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const sourceValue = sourceObj[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMergeSettings(
        result[key] as AppSettings,
        sourceValue as Partial<AppSettings>
      ) as unknown;
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }
  return result as unknown as AppSettings;
}

export async function loadThemeSettings(themeName: 'dark' | 'light'): Promise<Partial<AppSettings> | null> {
  let loaded: Partial<AppSettings> | null = null;

  if (window.__TAURI__?.core) {
    try {
      const themeSettings = await window.__TAURI__.core.invoke<AppSettings>(
        'load_theme',
        { theme: themeName }
      );
      if (themeSettings) {
        loaded = themeSettings;
      }
    } catch (e) {
      console.warn(`Tauri theme load failed for ${themeName}:`, e);
    }
  }

  try {
    const themeKey = `${window.__APP_CONFIG__?.id ?? 'app'}:theme:${themeName}`;
    const saved = localStorage.getItem(themeKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<AppSettings>;
      loaded = loaded ? deepMergeSettings(loaded as AppSettings, parsed) : parsed;
    }
  } catch (e) {
    console.warn(`localStorage theme load failed for ${themeName}:`, e);
  }

  return loaded;
}
