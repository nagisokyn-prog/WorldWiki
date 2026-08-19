import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the service after mocks are set up
import { settingsService } from '../../../src/ts/services/settings.service';

// Type augmentation for global mocks
declare global {
  var __TAURI__: {
    core?: {
      invoke?: ReturnType<typeof vi.fn>;
      convertFileSrc?: ReturnType<typeof vi.fn>;
    };
    fs?: {
      readFile?: ReturnType<typeof vi.fn>;
    };
  } | undefined;
}

/**
 * Пересоздаёт моки DOM/localStorage.
 * Нужно вызывать в beforeEach ПОСЛЕ vi.restoreAllMocks(), т.к. тот
 * сбрасывает setProperty/toggle/getItem обратно к реальным happy-dom функциям.
 */
function setupDomMocks(): void {
  // localStorage
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {});

  // document.documentElement.style
  vi.spyOn(document.documentElement.style, 'setProperty').mockImplementation(() => {});
  vi.spyOn(document.documentElement.style, 'getPropertyValue').mockImplementation(() => '');

  // document.body.classList & setAttribute & appendChild
  vi.spyOn(document.body.classList, 'add').mockImplementation(() => {});
  vi.spyOn(document.body.classList, 'remove').mockImplementation(() => {});
  vi.spyOn(document.body.classList, 'toggle').mockImplementation(() => false);
  vi.spyOn(document.body.classList, 'contains').mockImplementation(() => false);
  vi.spyOn(document.body, 'setAttribute').mockImplementation(() => {});
  vi.spyOn(document.body, 'appendChild').mockImplementation((node: any) => node);

  // document.getElementById
  vi.spyOn(document, 'getElementById').mockReturnValue(null);

  // console.warn & console.error
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('SettingsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    setupDomMocks();

    // Reset the service to default settings
    settingsService.resetSettings();
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should have all required settings categories', () => {
      const defaults = settingsService.getDefaultSettings();
      
      expect(defaults).toHaveProperty('locale');
      expect(defaults).toHaveProperty('colors');
      expect(defaults).toHaveProperty('glass');
      expect(defaults).toHaveProperty('radii');
      expect(defaults).toHaveProperty('shadows');
      expect(defaults).toHaveProperty('animations');
      expect(defaults).toHaveProperty('fonts');
      expect(defaults).toHaveProperty('spacing');
      expect(defaults).toHaveProperty('layout');
      expect(defaults).toHaveProperty('inputs');
      expect(defaults).toHaveProperty('buttons');
      expect(defaults).toHaveProperty('tabs');
      expect(defaults).toHaveProperty('dropdowns');
      expect(defaults).toHaveProperty('cards');
      expect(defaults).toHaveProperty('editor');
      expect(defaults).toHaveProperty('notifications');
      expect(defaults).toHaveProperty('perf');
      expect(defaults).toHaveProperty('background');
    });

    it('should return a deep clone of default settings', () => {
      const defaults1 = settingsService.getDefaultSettings();
      const defaults2 = settingsService.getDefaultSettings();
      
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('getSettings', () => {
    it('should return current settings', () => {
      const settings = settingsService.getSettings();
      
      expect(settings).toBeDefined();
      expect(settings.locale).toBe('ru');
    });

    it('should return a reference to internal settings', () => {
      const settings1 = settingsService.getSettings();
      const settings2 = settingsService.getSettings();
      
      expect(settings1).toBe(settings2);
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', () => {
      // Modify settings
      settingsService.getSettings().locale = 'en';
      settingsService.getSettings().colors.bgBase = '#ffffff';
      
      // Reset
      settingsService.resetSettings();
      
      const settings = settingsService.getSettings();
      expect(settings.locale).toBe('ru');
      expect(settings.colors.bgBase).toBe('#09090b');
    });

    it('should call saveSettings after reset', () => {
      const saveSpy = vi.spyOn(settingsService, 'saveSettings').mockResolvedValue(undefined);
      
      settingsService.resetSettings();
      
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('deepMerge', () => {
    it('should deeply merge objects', () => {
      const target = { a: { b: 1, c: 2 }, d: 3 };
      const source = { a: { b: 10 }, e: 4 };
      
      // Access private method via type assertion
      const result = (settingsService as any).deepMerge(target, source);
      
      expect(result.a.b).toBe(10);
      expect(result.a.c).toBe(2);
      expect(result.d).toBe(3);
      expect(result.e).toBe(4);
    });

    it('should handle undefined source values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: undefined, b: 3 };
      
      const result = (settingsService as any).deepMerge(target, source);
      
      expect(result.a).toBe(1);
      expect(result.b).toBe(3);
    });

    it('should not merge arrays recursively', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      
      const result = (settingsService as any).deepMerge(target, source);
      
      expect(result.arr).toEqual([4, 5]);
    });

    it('should handle nested objects correctly', () => {
      const target = { nested: { deep: { value: 'original' } } };
      const source = { nested: { deep: { value: 'updated' }, other: 'new' } };
      
      const result = (settingsService as any).deepMerge(target, source);
      
      expect(result.nested.deep.value).toBe('updated');
      expect(result.nested.other).toBe('new');
    });
  });

  describe('loadSettings', () => {
    it('should return default settings when no Tauri and no localStorage', async () => {
      // Mock no Tauri
      globalThis.__TAURI__ = undefined;
      
      // Mock empty localStorage
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.locale).toBe('ru');
      expect(settings.colors.bgBase).toBe('#09090b');
    });

    it('should load from localStorage when Tauri not available', async () => {
      globalThis.__TAURI__ = undefined;
      
      const savedSettings = {
        locale: 'en',
        colors: { bgBase: '#ffffff' }
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(savedSettings));
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.locale).toBe('en');
      expect(settings.colors.bgBase).toBe('#ffffff');
      // Other colors should come from defaults
      expect(settings.colors.textMain).toBe('#ffffff');
    });

    it('should handle corrupted localStorage JSON gracefully', async () => {
      globalThis.__TAURI__ = undefined;
      vi.mocked(localStorage.getItem).mockReturnValue('invalid json{');
      
      const settings = await settingsService.loadSettings();
      
      // Should fall back to defaults
      expect(settings.locale).toBe('ru');
    });

    it('should merge localStorage settings with defaults (deepMerge)', async () => {
      globalThis.__TAURI__ = undefined;
      
      const partialSettings = {
        colors: { bgBase: '#custom' }
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(partialSettings));
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.colors.bgBase).toBe('#custom');
      // Other colors should be from defaults
      expect(settings.colors.textMain).toBe('#ffffff');
    });

    it('should apply settings after loading from localStorage', async () => {
      globalThis.__TAURI__ = undefined;
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ locale: 'en' }));
      
      await settingsService.loadSettings();
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalled();
    });
  });

  describe('saveSettings', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should apply settings immediately', async () => {
      const applySpy = vi.spyOn(settingsService, 'applySettings');
      const applyLocaleSpy = vi.spyOn(settingsService as any, 'applyLocale');
      const notifySpy = vi.spyOn(settingsService as any, 'notifyListeners');
      
      try {
        const s = settingsService.getSettings();
        s.locale = 'en';
        await settingsService.saveSettings(s, true);
        
        if (applySpy.mock.calls.length === 0) {
          throw new Error('applySpy had 0 calls! Timeout? ' + !!settingsService.saveSettings);
        }
        
        expect(applySpy).toHaveBeenCalled();
        expect(applyLocaleSpy).toHaveBeenCalled();
        expect(notifySpy).toHaveBeenCalled();
      } catch (e) {
        throw new Error('TEST FAILED WITH: ' + e);
      }
    });

    it('should save to Tauri immediately when immediate=true', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(undefined) }
      } as any;
      
      const s = settingsService.getSettings();
      s.locale = 'en';
      await settingsService.saveSettings(s, true);
      
      expect(globalThis.__TAURI__!.core!.invoke).toHaveBeenCalledWith('save_settings', { settings: expect.any(Object) });
    });

    it('should save to localStorage immediately when immediate=true', async () => {
      globalThis.__TAURI__ = undefined;
      
      const s = settingsService.getSettings();
      s.locale = 'en';
      await settingsService.saveSettings(s, true);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'app:settings',
        expect.stringContaining('"locale":"en"')
      );
    });

    it('should debounce save when immediate=false', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(undefined) }
      } as any;
      
      const s = settingsService.getSettings();
      s.locale = 'en';
      const promise = settingsService.saveSettings(s, false);
      
      // Should not save yet
      expect(globalThis.__TAURI__!.core!.invoke).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      
      // Fast-forward timer
      await vi.advanceTimersByTimeAsync(300);
      
      // Now should have saved
      expect(globalThis.__TAURI__!.core!.invoke).toHaveBeenCalled();
      expect(localStorage.setItem).toHaveBeenCalled();
      
      await promise;
    });

    it('should clear existing timeout on new save', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(undefined) }
      } as any;
      
      // First save
      const s1 = settingsService.getSettings();
      s1.locale = 'en';
      settingsService.saveSettings(s1, false);
      
      // Second save before debounce
      const s2 = settingsService.getSettings();
      s2.locale = 'fr' as any;
      settingsService.saveSettings(s2, false);
      
      // Fast-forward past first debounce
      await vi.advanceTimersByTimeAsync(300);
      
      // Should only save once (the second one)
      expect(globalThis.__TAURI__!.core!.invoke).toHaveBeenCalledTimes(1);
      const savedSettings = (globalThis.__TAURI__!.core!.invoke as ReturnType<typeof vi.fn>).mock.calls[0][1].settings;
      expect(savedSettings.locale).toBe('fr');
    });

    it('should handle Tauri save failure gracefully', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockRejectedValue(new Error('Tauri error')) }
      } as any;
      
      const s = settingsService.getSettings();
      s.locale = 'en';
      await expect(settingsService.saveSettings(s, true)).resolves.not.toThrow();
      
      expect(console.warn).toHaveBeenCalledWith('Tauri settings save failed:', expect.any(Error));
    });

    it('should handle localStorage save failure gracefully', async () => {
      globalThis.__TAURI__ = undefined;
      vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Storage full'); });
      
      const s = settingsService.getSettings();
      s.locale = 'en';
      await expect(settingsService.saveSettings(s, true)).resolves.not.toThrow();
      
      expect(console.warn).toHaveBeenCalledWith('localStorage save failed:', expect.any(Error));
    });

    it('should stringify settings correctly for storage', async () => {
      globalThis.__TAURI__ = undefined;
      
      const testSettings = settingsService.getSettings();
      testSettings.locale = 'en';
      testSettings.perf.qualityLevel = 50;
      
      await settingsService.saveSettings(testSettings, true);
      
      const savedString = vi.mocked(localStorage.setItem).mock.calls[0][1];
      const parsed = JSON.parse(savedString);
      
      expect(parsed.locale).toBe('en');
      expect(parsed.perf.qualityLevel).toBe(50);
    });
  });

  describe('applyQualityLevel', () => {
    it('should set qualityLevel correctly', () => {
      settingsService.applyQualityLevel(50);
      
      const settings = settingsService.getSettings();
      expect(settings.perf.qualityLevel).toBe(50);
    });

    it('should calculate blur based on quality level (0-100)', () => {
      // 100% -> 24px blur
      settingsService.applyQualityLevel(100);
      expect(settingsService.getSettings().glass.blur).toBe(24);
      
      // 50% -> 12px blur
      settingsService.applyQualityLevel(50);
      expect(settingsService.getSettings().glass.blur).toBe(12);
      
      // 0% -> 0px blur
      settingsService.applyQualityLevel(0);
      expect(settingsService.getSettings().glass.blur).toBe(0);
    });

    it('should disable animations when quality < 20%', () => {
      settingsService.applyQualityLevel(100);
      expect(settingsService.getSettings().animations.enabled).toBe(true);
      
      settingsService.applyQualityLevel(20);
      expect(settingsService.getSettings().animations.enabled).toBe(true);
      
      settingsService.applyQualityLevel(19);
      expect(settingsService.getSettings().animations.enabled).toBe(false);
    });

    it('should scale animation speed based on quality', () => {
      // 100% -> 0.3s (min speed)
      settingsService.applyQualityLevel(100);
      expect(settingsService.getSettings().animations.speed).toBeCloseTo(0.3, 1);
      
      // 50% -> 0.45s
      settingsService.applyQualityLevel(50);
      expect(settingsService.getSettings().animations.speed).toBeCloseTo(0.45, 1);
      
      // 0% -> 0.6s (max speed = slowest)
      settingsService.applyQualityLevel(0);
      expect(settingsService.getSettings().animations.speed).toBeCloseTo(0.6, 1);
    });

    it('should scale islandAlpha inversely to quality', () => {
      // 100% -> 0.45 (more transparent)
      settingsService.applyQualityLevel(100);
      expect(settingsService.getSettings().glass.islandAlpha).toBeCloseTo(0.45, 2);
      
      // 0% -> 0.9 (less transparent)
      settingsService.applyQualityLevel(0);
      expect(settingsService.getSettings().glass.islandAlpha).toBeCloseTo(0.9, 2);
    });

    it('should call saveSettings after applying quality level', () => {
      const saveSpy = vi.spyOn(settingsService, 'saveSettings').mockResolvedValue(undefined);
      
      settingsService.applyQualityLevel(50);
      
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('applyBackground', () => {
    it('should create background container if not exists', () => {
      vi.mocked(document.getElementById).mockReturnValue(null);
      const spy = vi.spyOn(document, 'createElement');
      
      settingsService.applyBackground();
      
      expect(spy).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should reuse existing background container', () => {
      const existingContainer = document.createElement('div');
      existingContainer.id = 'ww-background';
      existingContainer.style.cssText = '';
      existingContainer.innerHTML = '';
      existingContainer.appendChild = vi.fn();
      vi.mocked(document.getElementById).mockReturnValue(existingContainer);
      
      settingsService.applyBackground();
      
      expect(existingContainer.innerHTML).toBe('');
    });

    it('should set opacity and blur on container', () => {
      const el = document.createElement('div');
      vi.mocked(document.getElementById).mockReturnValue(el);
      
      settingsService.getSettings().background = { opacity: 0.5, blur: 10, type: 'color', fit: 'cover' };
      settingsService.applyBackground();
      
      const container = document.getElementById('ww-background');
      expect(container).toBeDefined();
      expect(container!.style.opacity).toBe('0.5');
      expect(container!.style.filter).toBe('blur(10px)');
    });

    it('should handle color background type', () => {
      const el = document.createElement('div');
      vi.mocked(document.getElementById).mockReturnValue(el);
      
      settingsService.getSettings().background = { type: 'color', opacity: 1, blur: 0, fit: 'cover' };
      settingsService.applyBackground();
      
      const container = document.getElementById('ww-background');
      expect(container!.style.backgroundColor).toBe('var(--bg-base)');
    });

    
    it('should create image element for image background', () => {
      const el = document.createElement('div');
      el.appendChild = function(child: any) { this.innerHTML += (child as HTMLElement).outerHTML; return child; };
      vi.mocked(document.getElementById).mockReturnValue(el);
      
      settingsService.getSettings().background = { type: 'image', imagePath: '/test.jpg', opacity: 1, blur: 0, fit: 'cover' };
      settingsService.applyBackground();
      
      const container = document.getElementById('ww-background');
      const img = container!.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.style.objectFit).toBe('cover');
      expect(img!.src).toContain('/test.jpg');
    });

    it('should create video element for video background', () => {
      const container = document.createElement('div');
      container.style.cssText = '';
      container.appendChild = vi.fn();
      vi.spyOn(document, 'getElementById').mockReturnValue(container);
      
      const video = document.createElement('video');
      video.style.cssText = '';
      vi.spyOn(document, 'createElement').mockReturnValue(video);
      
      settingsService.getSettings().background = { 
        type: 'video', 
        videoPath: '/test.mp4', 
        opacity: 1, 
        blur: 0,
        fit: 'cover'
      };
      settingsService.applyBackground();
      
      expect(document.createElement).toHaveBeenCalledWith('video');
      expect(video.autoplay).toBe(true);
      expect(video.loop).toBe(true);
      expect(video.muted).toBe(true);
    });

    it('should use Tauri convertFileSrc when available', () => {
      const el = document.createElement('div');
      el.appendChild = function(child: any) { this.innerHTML += (child as HTMLElement).outerHTML; return child; };
      vi.mocked(document.getElementById).mockReturnValue(el);
      
      globalThis.__TAURI__ = {
        core: { convertFileSrc: vi.fn((path) => `tauri://${path}`) }
      } as any;
      
      settingsService.getSettings().background = { 
        type: 'image', 
        imagePath: '/local/path.jpg', 
        opacity: 1, 
        blur: 0,
        fit: 'cover'
      };
      settingsService.applyBackground();
      
      const container = document.getElementById('ww-background');
      const img = container!.querySelector('img');
      expect(globalThis.__TAURI__!.core!.convertFileSrc).toHaveBeenCalledWith('/local/path.jpg');
      expect(img!.src).toContain('tauri:///local/path.jpg');
    });

    it('should fallback to raw path when convertFileSrc not available', () => {
      const el = document.createElement('div');
      el.appendChild = function(child: any) { this.innerHTML += (child as HTMLElement).outerHTML; return child; };
      vi.mocked(document.getElementById).mockReturnValue(el);
      
      globalThis.__TAURI__ = { core: {} } as any;
      
      settingsService.getSettings().background = { 
        type: 'image', 
        imagePath: '/local/path.jpg', 
        opacity: 1, 
        blur: 0,
        fit: 'cover'
      };
      settingsService.applyBackground();
      
      const container = document.getElementById('ww-background');
      const img = container!.querySelector('img');       
      expect(img!.src).toContain('/local/path.jpg');     
    });

    it('should catch and log errors', () => {
      vi.mocked(document.getElementById).mockImplementation(() => { throw new Error('DOM error'); });
      
      expect(() => settingsService.applyBackground()).not.toThrow();
      expect(console.error).toHaveBeenCalledWith('Error applying background:', expect.any(Error));
    });
  });

  describe('applySettings', () => {
    it('should apply all color CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--bg-base', '#09090b');
      expect(setProperty).toHaveBeenCalledWith('--text-main', '#ffffff');
      expect(setProperty).toHaveBeenCalledWith('--accent', '#8b5cf6');
    });

    it('should apply glass CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--glass-island-alpha', '0.45');
      expect(setProperty).toHaveBeenCalledWith('--glass-blur', '24px');
      expect(setProperty).toHaveBeenCalledWith('--glass-border-alpha', '0.1');
    });

    it('should apply radii CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--radius-island', '28px');
      expect(setProperty).toHaveBeenCalledWith('--radius-card', '20px');
      expect(setProperty).toHaveBeenCalledWith('--radius-btn', '40px');
    });

    it('should apply shadows CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--shadow-island-y', '20px');
      expect(setProperty).toHaveBeenCalledWith('--shadow-island-blur', '35px');
    });

    it('should apply animations CSS variables when enabled', () => {
      settingsService.getSettings().animations.enabled = true;
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--anim-speed', expect.stringMatching(/0\.\d+s/));
      expect(setProperty).toHaveBeenCalledWith('--anim-entrance', expect.stringMatching(/0\.\d+s/));
      expect(document.body.classList.remove).toHaveBeenCalledWith('animations-disabled');
    });

    it('should disable animations CSS variables when disabled', () => {
      settingsService.getSettings().animations.enabled = false;
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--anim-speed', '0s');
      expect(setProperty).toHaveBeenCalledWith('--anim-entrance', '0s');
      expect(document.body.classList.add).toHaveBeenCalledWith('animations-disabled');
    });

    it('should apply fonts CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--font-family', 'Inter, system-ui, sans-serif');
      expect(setProperty).toHaveBeenCalledWith('--font-size-base', '14px');
      expect(setProperty).toHaveBeenCalledWith('--font-weight-base', '400');
    });

    it('should apply spacing CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--density-mult', '1');
      expect(setProperty).toHaveBeenCalledWith('--sidebar-width', '280px');
      expect(setProperty).toHaveBeenCalledWith('--panel-height', '250px');
    });

    it('should apply layout CSS variables', () => {
      settingsService.applySettings();
      
      const setProperty = vi.mocked(document.documentElement.style.setProperty);
      expect(setProperty).toHaveBeenCalledWith('--layout-columns', '2');
      expect(setProperty).toHaveBeenCalledWith('--sidebar-pos', 'row');
      expect(setProperty).toHaveBeenCalledWith('--tab-pos', 'row');
    });

    it('should toggle body classes based on settings', () => {
      settingsService.getSettings().shadows.useInset = true;
      settingsService.getSettings().animations.pulse = true;
      settingsService.getSettings().layout.focusMode = true;
      settingsService.getSettings().inputs.style = 'filled';
      settingsService.getSettings().inputs.focusAnim = true;
      settingsService.getSettings().buttons.hoverScale = true;
      settingsService.getSettings().buttons.clickPress = true;
      settingsService.getSettings().dropdowns.use3DWheel = true;
      settingsService.getSettings().cards.compactList = true;
      settingsService.getSettings().cards.showIcons = true;
      settingsService.getSettings().editor.showWordCount = true;
      
      settingsService.applySettings();
      
      expect(document.body.classList.toggle).toHaveBeenCalledWith('shadows-inset', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('animations-pulse', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('focus-mode', true);
      expect(document.body.setAttribute).toHaveBeenCalledWith('data-input-style', 'filled');
      expect(document.body.classList.toggle).toHaveBeenCalledWith('input-focus-anim', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('btn-hover-scale', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('btn-click-press', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('dropdown-3d-wheel', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('cards-compact', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('cards-show-icons', true);
      expect(document.body.classList.toggle).toHaveBeenCalledWith('editor-word-count', true);
    });

    it('should call applyBackground', () => {
      const applyBackgroundSpy = vi.spyOn(settingsService, 'applyBackground');
      
      settingsService.applySettings();
      
      expect(applyBackgroundSpy).toHaveBeenCalled();
    });
  });

  describe('switchTheme', () => {
    it('should load theme from Tauri when available', async () => {
      const themeSettings = { colors: { bgBase: '#custom' } };
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(themeSettings) }
      } as any;
      
      await settingsService.switchTheme('dark');
      
      expect(globalThis.__TAURI__!.core!.invoke).toHaveBeenCalledWith('load_theme', { theme: 'dark' });
    });

    it('should merge theme settings with current settings', async () => {
      const themeSettings = { colors: { bgBase: '#custom' } };
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(themeSettings) }
      } as any;
      
      await settingsService.switchTheme('dark');
      
      expect(settingsService.getSettings().colors.bgBase).toBe('#custom');
    });

    it('should fallback to defaults for dark theme when Tauri fails', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockRejectedValue(new Error('Tauri error')) }
      } as any;
      
      await settingsService.switchTheme('dark');
      
      expect(settingsService.getSettings().colors.bgBase).toBe('#09090b');
    });

    it('should try localStorage for theme', async () => {
      globalThis.__TAURI__ = undefined;
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ colors: { bgBase: '#local' } }));
      
      await settingsService.switchTheme('dark');
      
      expect(localStorage.getItem).toHaveBeenCalledWith('app:theme:dark');
    });

    it('should call saveSettings after switching theme', async () => {
      const saveSpy = vi.spyOn(settingsService, 'saveSettings').mockResolvedValue(undefined);
      globalThis.__TAURI__ = undefined;
      
      await settingsService.switchTheme('dark');
      
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('getCurrentTheme', () => {
    it('should return current theme or default to dark', () => {
      (settingsService.getSettings() as any).theme = 'light';
      expect(settingsService.getCurrentTheme()).toBe('light');
      
      (settingsService.getSettings() as any).theme = undefined;
      expect(settingsService.getCurrentTheme()).toBe('dark');
    });
  });

  describe('onChange / notifyListeners', () => {
    it('should allow subscribing to settings changes', () => {
      const listener = vi.fn();
      
      settingsService.onChange(listener);
      
      // Trigger a change
      settingsService.resetSettings();
      
      expect(listener).toHaveBeenCalled();
    });

    it('should notify all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      settingsService.onChange(listener1);
      settingsService.onChange(listener2);
      
      settingsService.resetSettings();
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should pass current settings to listeners', () => {
      const listener = vi.fn();
      settingsService.onChange(listener);
      
      settingsService.getSettings().locale = 'en';
      (settingsService as any).notifyListeners();
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
    });
  });

  describe('switchTheme explicit branch coverage', () => {
    it('line 389-390: Tauri returns null for dark theme → merges getDefaultSettings()', async () => {
      globalThis.__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(null) },
      } as any;
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      const saveSpy = vi.spyOn(settingsService, 'saveSettings');

      await settingsService.switchTheme('dark');

      // Default settings applied
      expect(settingsService.getSettings().colors.bgBase).toBe('#09090b');
      expect(saveSpy).toHaveBeenCalled();
      saveSpy.mockRestore();
      delete (globalThis as any).__TAURI__;
    });

    it('line 411: localStorage.getItem throws in switchTheme → console.warn called', async () => {
      delete (window as any).__TAURI__;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      await settingsService.switchTheme('light');

      expect(warnSpy).toHaveBeenCalledWith(
        'localStorage theme load failed for light:', expect.any(Error)
      );

      warnSpy.mockRestore();
    });

    it('handles Tauri constructor event listener and callback (lines 63-71)', async () => {
      let eventCallback: any;
      (window as any).__TAURI__ = {
        event: {
          listen: vi.fn((name, cb) => {
            eventCallback = cb;
            return Promise.resolve();
          }),
        },
      };

      const SvcClass = settingsService.constructor as any;
      const testService = new SvcClass();

      expect((window as any).__TAURI__.event.listen).toHaveBeenCalledWith('settings-updated', expect.any(Function));

      // Trigger listener with payload
      eventCallback({ payload: { colors: { accent: '#112233' } } });
      expect(testService.getSettings().colors.accent).toBe('#112233');

      // Trigger listener with falsy payload
      eventCallback({ payload: null });

      // Test listener rejection catch
      (window as any).__TAURI__.event.listen = vi.fn().mockRejectedValue(new Error('Listener failed'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      new SvcClass();
      await Promise.resolve();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
      delete (window as any).__TAURI__;
    });

    it('handles loadSettings from Tauri when successful, null, or failing (lines 84-94)', async () => {
      // 1. Success
      (window as any).__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue({ colors: { accent: '#445566' } }) },
      };
      const loaded = await settingsService.loadSettings();
      expect(loaded.colors.accent).toBe('#445566');

      // 2. Null response
      (window as any).__TAURI__.core.invoke = vi.fn().mockResolvedValue(null);
      await settingsService.loadSettings();

      // 3. Rejection
      (window as any).__TAURI__.core.invoke = vi.fn().mockRejectedValue(new Error('Tauri load failed'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await settingsService.loadSettings();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
      delete (window as any).__TAURI__;
    });

    it('handles saveSettings with Tauri event emit and immediate=true (line 143)', async () => {
      (window as any).__TAURI__ = {
        core: { invoke: vi.fn().mockResolvedValue(undefined) },
        event: { emit: vi.fn().mockResolvedValue(undefined) },
      };

      // 1. Successful save & emit
      await settingsService.saveSettings(null, true);
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('save_settings', expect.any(Object));
      expect((window as any).__TAURI__.event.emit).toHaveBeenCalledWith('settings-updated', expect.any(Object));

      // 2. Tauri invoke fails
      (window as any).__TAURI__.core.invoke = vi.fn().mockRejectedValue(new Error('Save failed'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await settingsService.saveSettings(null, true);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
      delete (window as any).__TAURI__;
    });
  });
});
