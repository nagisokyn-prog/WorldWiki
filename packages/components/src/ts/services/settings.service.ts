/**
 * @file settings.service.ts
 * @description Сервис для управления настройками приложения
 * @rust-ready ✅ loadSettings, saveSettings, calculateLoadMeter, autoDetectFPS
 */

import { setLocale } from '../i18n';
import type { AppSettings } from '../types/settings';

// Dynamically accessed via window.__TAURI__ to avoid bundler issues in shared components

const DEFAULT_SETTINGS: AppSettings = {
  locale: 'ru',
  colors: {
    bgBase: '#09090b', bgSecondary: '#121214', bgPanel: 'rgba(15,15,18,0.7)',
    bgInput: 'rgba(22,22,26,0.6)', textMain: '#ffffff', textMuted: 'rgba(255,255,255,0.65)',
    textHeading: '#ffffff', accent: '#8b5cf6', accentHover: '#7c3aed',
    accentActive: '#6d28d9', accentDisabled: '#4c1d95', accentGlow: 'rgba(139,92,246,0.3)', accentText: '#ffffff',
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
  editor: { showWordCount: true, requireCtrlForLinks: false, autoSaveInterval: 60, snapshotInterval: 15, maxSnapshots: 10 },
  notifications: { duration: 3000, position: 'bottom-right' },
  perf: { level: 'auto', fpsLimit: 60, loadMeter: 0, qualityLevel: 100 },
  background: { type: 'none', opacity: 1, blur: 0, fit: 'cover', fpsLimit: 30 }
};

class SettingsService {
  private settings: AppSettings;
  private listeners: ((settings: AppSettings) => void)[] = [];

  constructor() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    if (typeof window !== 'undefined') {
      // Синхронизация между вкладками браузера
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

      // Синхронизация между окнами Tauri
      if ((window as any).__TAURI__?.event) {
        (window as any).__TAURI__.event.listen('settings-updated', (event: { payload: AppSettings }) => {
          if (event.payload) {
            this.settings = this.deepMerge(DEFAULT_SETTINGS, event.payload);
            this.applySettings();
            this.applyLocale();
            this.notifyListeners();
          }
        }).catch((e: any) => console.warn('Failed to listen to settings-updated', e));
      }
    }
  }

  /**
   * Загружает настройки из Tauri или localStorage
   * @rust-ready ✅
   */
  async loadSettings(): Promise<AppSettings> {
    console.log('[settingsService] loading settings...');
    // Сначала пробуем загрузить из Tauri
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

    // Fallback на localStorage
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
   * Сохраняет настройки в Tauri и localStorage
   * @rust-ready ✅
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
          if (window.__TAURI__.event) {
            await window.__TAURI__.event.emit('settings-updated', this.settings);
          }
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
   * Возвращает настройки по умолчанию
   */
  getDefaultSettings(): AppSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  /**
   * Сбрасывает настройки к значениям по умолчанию
   */
  resetSettings(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }

  /**
   * Возвращает текущие настройки
   */
  getSettings(): AppSettings {
    return this.settings;
  }

  private applyLocale(): void {
    const locale = (this.settings as AppSettings & { locale?: 'ru' | 'en' }).locale || 'ru';
    setLocale(locale as 'ru' | 'en');
  }

  /**
   * Применяет "Уровень красоты" ко всем связанным параметрам
   */
  applyQualityLevel(level: number): void {
    this.settings.perf.qualityLevel = level;
    
    // Масштабируем параметры от 0 до 100
    const ratio = level / 100;
    
    // Blur от 0 до 24
    this.settings.glass.blur = Math.round(24 * ratio);
    
    // Анимации отключаем при < 20%
    this.settings.animations.enabled = level >= 20;
    
    // Скорость анимации: при 100% - 0.3s, при 20% - 0.6s
    this.settings.animations.speed = 0.6 - (0.3 * ratio);
    
    // Прозрачность островков: при 100% - 0.45, при 0% - 0.9 (менее прозрачно для экономии)
    this.settings.glass.islandAlpha = 0.9 - (0.45 * ratio);
    
    this.saveSettings();
  }

  /**
   * Применяет пользовательский фон (создает видео или картинку подложку)
   */
  applyBackground(): void {
    try {
      const bg = this.settings.background;
      if (!bg) return;
      
      let container = document.getElementById('ww-background');
      if (!container) {
        container = document.createElement('div');
        container.id = 'ww-background';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.zIndex = '-1';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
      }
      
      container.innerHTML = ''; // Очищаем старый фон
      container.style.opacity = String(bg.opacity);
      container.style.filter = `blur(${bg.blur}px)`;
      
      const applySrc = (el: HTMLImageElement | HTMLVideoElement, path: string) => {
        // Не конвертируем, если путь уже является URL (asset.localhost, blob:, data:, http:)
        const isAlreadyUrl = path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:');
        if (!isAlreadyUrl && (window as any).__TAURI__?.core?.convertFileSrc) {
          el.src = (window as any).__TAURI__.core.convertFileSrc(path);
        } else {
          el.src = path;
        }
      };

      if (bg.type === 'color') {
        container.style.backgroundColor = 'var(--bg-base)';
      } else if (bg.type === 'image' && bg.imagePath) {
        const img = document.createElement('img');
        applySrc(img, bg.imagePath);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = bg.fit;
        container.appendChild(img);
      } else if (bg.type === 'video' && bg.videoPath) {
        const video = document.createElement('video');
        applySrc(video, bg.videoPath);
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = bg.fit;
        container.appendChild(video);
      }
    } catch (e) {
      console.error('Error applying background:', e);
    }
  }

  /**
   * Применяет настройки к CSS переменным
   */
  applySettings(): void {
    const root = document.documentElement;
    if (!root) return;
    const s = this.settings;
    
    this.applyBackground();

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
    root.style.setProperty('--accent-text', s.colors.accentText);
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
   * Переключает тему (dark/light)
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

    // Fallback: локальное хранилище
    try {
      const themeKey = `${(window as any).__APP_CONFIG__?.id ?? "app"}:theme:${themeName}`;
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
   * Возвращает текущую выбранную тему
   */
  getCurrentTheme(): 'dark' | 'light' {
    return (this.settings as any).theme || 'dark';
  }

  /**
   * Глубокое слияние объектов
   * @rust-ready ✅
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
   * Подписка на изменения настроек
   */
  onChange(listener: (settings: AppSettings) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Уведомляет подписчиков об изменениях
   */
  private notifyListeners(): void {
    this.listeners.forEach(fn => fn(this.settings));
  }
}

export const settingsService = new SettingsService();

// Глобальный доступ для совместимости
declare global {
  interface Window {
    settingsService: SettingsService;
  }
}

if (typeof window !== 'undefined') {
  window.settingsService = settingsService;
}
