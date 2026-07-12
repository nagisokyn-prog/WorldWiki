/**
 * @file settings.service.ts
 * @description Ð¡ÐµÑ€Ð²Ð¸Ñ Ð´Ð»Ñ ÑƒÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ñ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ°Ð¼Ð¸ Ð¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ
 * @rust-ready âœ… loadSettings, saveSettings, calculateLoadMeter, autoDetectFPS
 */

import { setLocale } from '../i18n';
import type { AppSettings } from '../types/settings';

const DEFAULT_SETTINGS: AppSettings = {
  locale: 'ru',
  colors: {
    bgBase: '#09090b', bgSecondary: '#121214', bgPanel: 'rgba(15,15,18,0.7)',
    bgInput: 'rgba(22,22,26,0.6)', textMain: '#ffffff', textMuted: 'rgba(255,255,255,0.65)',
    textHeading: '#ffffff', accent: '#8b5cf6', accentHover: '#7c3aed',
    accentActive: '#6d28d9', accentDisabled: '#4c1d95', accentGlow: 'rgba(139,92,246,0.3)',
    borderColor: 'rgba(255,255,255,0.1)', borderActive: 'rgba(139,92,246,0.5)',
    shadowColor: 'rgba(0,0,0,0.5)'
  },
  glass: { islandAlpha: 0.45, cardAlpha: 0.03, blur: 24, borderAlpha: 0.1, highlight: 'rgba(255,255,255,0.08)' },
  radii: { island: 28, card: 20, btn: 40, input: 16, dropdown: 16 },
  shadows: { islandY: 20, islandBlur: 35, useInset: false },
  animations: { enabled: true, speed: 0.3, ease: 'cubic-bezier(0.2,0.8,0.2,1)', entrance: 0.4, pulse: true, scalePush: 0.98, scalePull: 1.05 },
  fonts: { family: 'Inter', size: 14, weight: 400, weightBold: 600, lineHeight: 1.5, letterSpacing: 0 },
  spacing: { density: 1, sidebarWidth: 280, panelHeight: 250, activityBarWidth: 60, toolbarHeight: 48, gap: 16 },
  layout: { columns: 2, sidebarPos: 'row', tabPos: 'row', focusMode: false },
  inputs: { style: 'outline', focusAnim: true },
  buttons: { hoverScale: true, clickPress: true },
  tabs: { pos: 'row' },
  dropdowns: { use3DWheel: true, wheelOrientation: 'vertical' },
  cards: { compactList: false, showIcons: true },
  editor: { showWordCount: true, requireCtrlForLinks: false },
  notifications: { duration: 3000, position: 'bottom-right' },
  perf: { level: 'auto', fpsLimit: 60, loadMeter: 0 }
};

class SettingsService {
  private settings: AppSettings;
  private listeners: Array<(settings: AppSettings) => void>;

  constructor() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.listeners = [];

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === ((window as any).__APP_CONFIG__?.storageKey ?? 'app:settings') && e.newValue) {
          try {
            const newSettings = JSON.parse(e.newValue);
            this.settings = this.deepMerge(this.settings, newSettings);
            this.applySettings();
            this.notifyListeners();
          } catch (err) {
            console.error('Failed to sync settings from storage', err);
          }
        }
      });
    }
  }

  /**
   * Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÑ‚ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð¸Ð· Tauri Ð¸Ð»Ð¸ localStorage
   * @rust-ready âœ…
   */
  async loadSettings(): Promise<AppSettings> {
    console.log('[settingsService] loading settings...');
    // Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ñ€Ð¾Ð±ÑƒÐµÐ¼ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ð¸Ð· Tauri
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

    // Fallback Ð½Ð° localStorage
    try {
      const saved = localStorage.getItem((window as any).__APP_CONFIG__?.storageKey ?? 'app:settings');
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

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÑ‚ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð² Tauri Ð¸ localStorage
   * @rust-ready âœ…
   */
  async saveSettings(settings: AppSettings | null = null, immediate = false): Promise<void> {
    if (settings) {
      // Очищаем объект от Vue Proxy перед сохранением
      this.settings = JSON.parse(JSON.stringify(settings));
    }

    // Применяем стили и язык мгновенно для отзывчивости UI
    this.applySettings();
    this.applyLocale();
    this.notifyListeners();

    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    const persist = async () => {
      console.log('[settingsService] saving settings to backend:', JSON.stringify(this.settings).substring(0, 100));

      // Сохраняем в Tauri
      if (window.__TAURI__?.core) {
        try {
          await window.__TAURI__.core.invoke('save_settings', { settings: this.settings });
        } catch (e) {
          console.warn('Tauri settings save failed:', e);
        }
      }

      // Fallback на localStorage
      try {
        localStorage.setItem((window as any).__APP_CONFIG__?.storageKey ?? 'app:settings', JSON.stringify(this.settings));
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

  /**
   * Ð’Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ
   */
  getDefaultSettings(): AppSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  /**
   * Ð¡Ð±Ñ€Ð°ÑÑ‹Ð²Ð°ÐµÑ‚ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ðº Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸ÑÐ¼ Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ
   */
  resetSettings(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }

  /**
   * Ð’Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ðµ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸
   */
  getSettings(): AppSettings {
    return this.settings;
  }

  private applyLocale(): void {
    const locale = (this.settings as AppSettings & { locale?: 'ru' | 'en' }).locale || 'ru';
    setLocale(locale as 'ru' | 'en');
  }

  /**
   * ÐŸÑ€Ð¸Ð¼ÐµÐ½ÑÐµÑ‚ Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ðº CSS Ð¿ÐµÑ€ÐµÐ¼ÐµÐ½Ð½Ñ‹Ð¼
   */
  applySettings(): void {
    const root = document.documentElement;
    if (!root) return;
    const s = this.settings;

    // Colors
    root.style.setProperty('--bg-base', s.colors.bgBase);
    root.style.setProperty('--bg-secondary', s.colors.bgSecondary);
    root.style.setProperty('--bg-panel', s.colors.bgPanel);
    root.style.setProperty('--bg-input', s.colors.bgInput);
    root.style.setProperty('--text-main', s.colors.textMain);
    root.style.setProperty('--text-muted', s.colors.textMuted);
    root.style.setProperty('--text-heading', s.colors.textHeading);
    root.style.setProperty('--accent', s.colors.accent);
    root.style.setProperty('--accent-hover', s.colors.accentHover);
    root.style.setProperty('--accent-active', s.colors.accentActive);
    root.style.setProperty('--accent-disabled', s.colors.accentDisabled);
    root.style.setProperty('--accent-glow', s.colors.accentGlow);
    root.style.setProperty('--border-color', s.colors.borderColor);
    root.style.setProperty('--border-active', s.colors.borderActive);
    root.style.setProperty('--shadow-color', s.colors.shadowColor);

    // Glass
    root.style.setProperty('--glass-island-alpha', String(s.glass.islandAlpha));
    root.style.setProperty('--glass-card-alpha', String(s.glass.cardAlpha));
    root.style.setProperty('--glass-blur', `${s.glass.blur}px`);
    root.style.setProperty('--glass-border-alpha', String(s.glass.borderAlpha));
    root.style.setProperty('--glass-highlight', s.glass.highlight);

    // Radii
    root.style.setProperty('--radius-island', `${s.radii.island}px`);
    root.style.setProperty('--radius-card', `${s.radii.card}px`);
    root.style.setProperty('--radius-btn', `${s.radii.btn}px`);
    root.style.setProperty('--radius-input', `${s.radii.input}px`);
    root.style.setProperty('--radius-dropdown', `${s.radii.dropdown}px`);

    // Shadows
    root.style.setProperty('--shadow-island-y', `${s.shadows.islandY}px`);
    root.style.setProperty('--shadow-island-blur', `${s.shadows.islandBlur}px`);

    // Animations
    if (s.animations.enabled) {
      root.style.setProperty('--anim-speed', `${s.animations.speed}s`);
      root.style.setProperty('--anim-entrance', `${s.animations.entrance}s`);
      document.body.classList.remove('animations-disabled');
    } else {
      root.style.setProperty('--anim-speed', '0s');
      root.style.setProperty('--anim-entrance', '0s');
      document.body.classList.add('animations-disabled');
    }
    
    root.style.setProperty('--anim-ease', s.animations.ease);
    root.style.setProperty('--scale-push', String(s.animations.scalePush));
    root.style.setProperty('--scale-pull', String(s.animations.scalePull));

    // Fonts
    root.style.setProperty('--font-family', `${s.fonts.family}, system-ui, sans-serif`);
    root.style.setProperty('--font-size-base', `${s.fonts.size}px`);
    root.style.setProperty('--font-weight-base', String(s.fonts.weight));
    root.style.setProperty('--font-weight-bold', String(s.fonts.weightBold));
    root.style.setProperty('--line-height-base', String(s.fonts.lineHeight));
    root.style.setProperty('--letter-spacing-base', `${s.fonts.letterSpacing}px`);

    // Spacing
    root.style.setProperty('--density-mult', String(s.spacing.density));
    root.style.setProperty('--sidebar-width', `${s.spacing.sidebarWidth}px`);
    root.style.setProperty('--panel-height', `${s.spacing.panelHeight}px`);
    root.style.setProperty('--activity-bar-width', `${s.spacing.activityBarWidth}px`);
    root.style.setProperty('--toolbar-height', `${s.spacing.toolbarHeight}px`);
    root.style.setProperty('--gap-elements', `${s.spacing.gap}px`);

    // Layout
    root.style.setProperty('--layout-columns', String(s.layout.columns));
    root.style.setProperty('--sidebar-pos', s.layout.sidebarPos);
    root.style.setProperty('--tab-pos', s.layout.tabPos);

    // Apply logical UI settings as classes and attributes to body
    const body = document.body;
    body.classList.toggle('shadows-inset', s.shadows.useInset);
    body.classList.toggle('animations-pulse', s.animations.pulse);
    body.classList.toggle('focus-mode', s.layout.focusMode);
    
    body.setAttribute('data-input-style', s.inputs.style);
    body.classList.toggle('input-focus-anim', s.inputs.focusAnim);
    body.classList.toggle('btn-hover-scale', s.buttons.hoverScale);
    body.classList.toggle('btn-click-press', s.buttons.clickPress);
    body.classList.toggle('dropdown-3d-wheel', s.dropdowns.use3DWheel);
    body.classList.toggle('cards-compact', s.cards.compactList);
    body.classList.toggle('cards-show-icons', s.cards.showIcons);
    body.classList.toggle('editor-word-count', s.editor.showWordCount);
  }

  /**
   * ÐŸÐµÑ€ÐµÐºÐ»ÑŽÑ‡Ð°ÐµÑ‚ Ñ‚ÐµÐ¼Ñƒ (dark/light)
   */
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
        } else if (themeName === 'dark') {
          this.settings = this.deepMerge(this.settings, this.getDefaultSettings());
        }
      } catch (e) {
        console.warn(`Tauri theme load failed for ${themeName}:`, e);
        if (themeName === 'dark') {
          this.settings = this.deepMerge(this.settings, this.getDefaultSettings());
        }
      }
    } else if (themeName === 'dark') {
      this.settings = this.deepMerge(this.settings, this.getDefaultSettings());
    }

    // Fallback: Ð»Ð¾ÐºÐ°Ð»ÑŒÐ½Ð¾Ðµ Ñ…Ñ€Ð°Ð½Ð¸Ð»Ð¸Ñ‰Ðµ
    try {
      const themeKey = `\${(window as any).__APP_CONFIG__?.id ?? "app"}:theme:\${themeName}`;
      const saved = localStorage.getItem(themeKey);
      if (saved) {
        const themeSettings = JSON.parse(saved) as Partial<AppSettings>;
        this.settings = this.deepMerge(this.settings, themeSettings);
      }
    } catch (e) {
      console.warn(`localStorage theme load failed for ${themeName}:`, e);
    }

    this.saveSettings();
  }

  /**
   * Ð’Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ Ñ‚ÐµÐºÑƒÑ‰ÑƒÑŽ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½ÑƒÑŽ Ñ‚ÐµÐ¼Ñƒ
   */
  getCurrentTheme(): 'dark' | 'light' {
    return (this.settings as any).theme || 'dark';
  }

  /**
   * Ð“Ð»ÑƒÐ±Ð¾ÐºÐ¾Ðµ ÑÐ»Ð¸ÑÐ½Ð¸Ðµ Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð²
   * @rust-ready âœ…
   */
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

  /**
   * ÐŸÐ¾Ð´Ð¿Ð¸ÑÐºÐ° Ð½Ð° Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð½Ð°ÑÑ‚Ñ€Ð¾ÐµÐº
   */
  onChange(listener: (settings: AppSettings) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Ð£Ð²ÐµÐ´Ð¾Ð¼Ð»ÑÐµÑ‚ Ð¿Ð¾Ð´Ð¿Ð¸ÑÑ‡Ð¸ÐºÐ¾Ð² Ð¾Ð± Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸ÑÑ…
   */
  private notifyListeners(): void {
    this.listeners.forEach(fn => fn(this.settings));
  }
}

export const settingsService = new SettingsService();

// Ð“Ð»Ð¾Ð±Ð°Ð»ÑŒÐ½Ñ‹Ð¹ Ð´Ð¾ÑÑ‚ÑƒÐ¿ Ð´Ð»Ñ ÑÐ¾Ð²Ð¼ÐµÑÑ‚Ð¸Ð¼Ð¾ÑÑ‚Ð¸
declare global {
  interface Window {
    settingsService: SettingsService;
  }
}

if (typeof window !== 'undefined') {
  window.settingsService = settingsService;
}
