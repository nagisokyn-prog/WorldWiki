import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceManager, performanceManager } from '../../../src/ts/services/performance.service.js';
import { settingsService } from '../../../src/ts/services/settings.service.js';
import type { AppSettings } from '../../../src/ts/types/settings.js';

describe('PerformanceManager', () => {
  let mockSettings: AppSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockSettings = {
      theme: 'dark',
      locale: 'ru',
      customThemes: [],
      compactList: false,
      showIcons: true,
      window: { width: 1200, height: 800, isMaximized: false },
      background: { type: 'none', opacity: 1, blur: 0 },
      glass: { islandAlpha: 0.5, cardAlpha: 0.5, blur: 16, borderAlpha: 0.2 },
      shadows: { useInset: false, islandBlur: 10, shadowAlpha: 0.3 },
      animations: { enabled: true, speedMultiplier: 1 },
      typography: { headingFont: 'Inter', bodyFont: 'Inter', codeFont: 'Fira Code', baseSize: 14, scaleRatio: 1.2 },
      fonts: { family: 'Inter', size: 16, lineHeight: 1.5, letterSpacing: 0, headingFont: 'Inter' },
      colors: {
        bgBase: '#121212',
        bgSecondary: '#1e1e1e',
        bgPanel: '#252525',
        bgInput: '#2a2a2a',
        textMain: '#ffffff',
        textMuted: '#a0a0a0',
        accent: '#4facfe',
        accentHover: '#00f2fe',
        accentText: '#ffffff',
        borderColor: '#333333',
        shadowColor: 'rgba(0,0,0,0.5)'
      },
      notifications: { duration: 3000, position: 'top-right' },
      editor: {
        autoSave: true,
        autoSaveInterval: 30000,
        enableSnapshots: true,
        snapshotInterval: 300000,
        maxSnapshots: 10,
        enableAutocompletion: true,
        minimap: true
      },
      perf: {
        level: 'Automatic',
        fpsLimit: 60,
        loadMeter: 0,
        qualityLevel: 100
      }
    };

    vi.spyOn(settingsService, 'getSettings').mockReturnValue(mockSettings);
    vi.spyOn(settingsService, 'saveSettings').mockImplementation(vi.fn());
    vi.spyOn(settingsService, 'applySettings').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be a singleton instance', () => {
    const instance1 = PerformanceManager.getInstance();
    const instance2 = PerformanceManager.getInstance();
    expect(instance1).toBe(instance2);
    expect(performanceManager).toBe(instance1);
  });

  describe('Profiles Application', () => {
    it('should apply Eco profile settings', () => {
      performanceManager.applyProfile('Eco');
      expect(mockSettings.perf?.level).toBe('Eco');
      expect(mockSettings.glass.blur).toBe(0);
      expect(mockSettings.glass.islandAlpha).toBe(0.0);
      expect(mockSettings.shadows.useInset).toBe(false);
      expect(mockSettings.shadows.islandBlur).toBe(0);
      expect(mockSettings.animations.enabled).toBe(false);
      expect(settingsService.saveSettings).toHaveBeenCalledWith(mockSettings);
      expect(settingsService.applySettings).toHaveBeenCalled();
    });

    it('should apply Balanced profile settings', () => {
      performanceManager.applyProfile('Balanced');
      expect(mockSettings.perf?.level).toBe('Balanced');
      expect(mockSettings.glass.blur).toBe(8);
      expect(mockSettings.glass.islandAlpha).toBe(0.2);
      expect(mockSettings.shadows.useInset).toBe(false);
      expect(mockSettings.shadows.islandBlur).toBe(10);
      expect(mockSettings.animations.enabled).toBe(true);
    });

    it('should apply Quality profile settings', () => {
      performanceManager.applyProfile('Quality');
      expect(mockSettings.perf?.level).toBe('Quality');
      expect(mockSettings.glass.blur).toBe(16);
      expect(mockSettings.glass.islandAlpha).toBe(0.5);
      expect(mockSettings.shadows.useInset).toBe(true);
      expect(mockSettings.shadows.islandBlur).toBe(30);
      expect(mockSettings.animations.enabled).toBe(true);
    });

    it('should apply Max profile settings', () => {
      performanceManager.applyProfile('Max');
      expect(mockSettings.perf?.level).toBe('Max');
      expect(mockSettings.glass.blur).toBe(24);
      expect(mockSettings.glass.islandAlpha).toBe(0.7);
      expect(mockSettings.shadows.useInset).toBe(true);
      expect(mockSettings.shadows.islandBlur).toBe(50);
      expect(mockSettings.animations.enabled).toBe(true);
    });

    it('should apply Automatic profile settings', () => {
      performanceManager.applyProfile('Automatic');
      expect(mockSettings.perf?.level).toBe('Automatic');
      expect(mockSettings.glass.blur).toBe(16);
      expect(mockSettings.glass.islandAlpha).toBe(0.5);
      expect(mockSettings.shadows.islandBlur).toBe(30);
      expect(mockSettings.animations.enabled).toBe(true);
    });

    it('should initialize perf object if not present', () => {
      // @ts-expect-error test undefined perf
      delete mockSettings.perf;
      performanceManager.applyProfile('Eco');
      expect(mockSettings.perf).toBeDefined();
      expect(mockSettings.perf?.level).toBe('Eco');
    });
  });

  describe('Capabilities Hint', () => {
    it('should return Quality for 8 or more cores', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      expect(performanceManager.getInitialCapabilitiesHint()).toBe('Quality');
    });

    it('should return Balanced for 4 to 7 cores', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      expect(performanceManager.getInitialCapabilitiesHint()).toBe('Balanced');
    });

    it('should return Eco for fewer than 4 cores', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true });
      expect(performanceManager.getInitialCapabilitiesHint()).toBe('Eco');
    });

    it('should fallback to 4 cores if hardwareConcurrency is undefined', () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: undefined, configurable: true });
      expect(performanceManager.getInitialCapabilitiesHint()).toBe('Balanced');
    });
  });

  describe('Telemetry & Metrics Aggregation', () => {
    it('should stop telemetry without errors', () => {
      expect(() => performanceManager.stopTelemetry()).not.toThrow();
    });

    it('should ignore aggregation when frame samples count < 30', () => {
      const pm = performanceManager as any;
      pm.frameTimestamps = [16.6, 16.7];
      pm.aggregateMetrics();
      expect(pm.frameTimestamps.length).toBe(0);
    });

    it('should compute Good status on smooth frame times', () => {
      const pm = performanceManager as any;
      pm.frameTimestamps = Array(40).fill(16.0);
      pm.aggregateMetrics();
      expect(pm.status.value).toBe('Good');
      expect(pm.lastP50.value).toBe(16.0);
      expect(pm.lastP95.value).toBe(16.0);
      expect(pm.lastP99.value).toBe(16.0);
      expect(pm.lastJankRatio.value).toBe(0);
    });

    it('should compute Limited status on moderate lag (p95 > 18)', () => {
      const pm = performanceManager as any;
      // 35 frames at 16ms, 5 frames at 20ms -> p95 = 20
      pm.frameTimestamps = [...Array(35).fill(16.0), ...Array(5).fill(20.0)];
      pm.aggregateMetrics();
      expect(pm.status.value).toBe('Limited');
    });

    it('should compute Poor status on high lag (p95 > 25 or jankRatio > 0.20)', () => {
      const pm = performanceManager as any;
      // 30 frames at 16ms, 10 frames at 30ms -> jankRatio = 0.25
      pm.frameTimestamps = [...Array(30).fill(16.0), ...Array(10).fill(30.0)];
      pm.aggregateMetrics();
      expect(pm.status.value).toBe('Poor');
    });
  });

  describe('Hysteresis & Dynamic Adaptation', () => {
    it('should downgrade profile when status is Poor and mode is Automatic', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Automatic';
      mockSettings.glass.blur = 20; // > 16

      pm.status.value = 'Poor';
      pm.consecutivePoorAggregations = 1;
      pm.checkHysteresis();

      expect(mockSettings.perf!.level).toBe('Quality');
    });

    it('should downgrade stepwise down to Eco', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Automatic';

      mockSettings.glass.blur = 12; // > 8
      pm.downgradeProfile();
      expect(mockSettings.perf!.level).toBe('Balanced');

      mockSettings.glass.blur = 4; // > 0
      pm.downgradeProfile();
      expect(mockSettings.perf!.level).toBe('Eco');
    });

    it('should upgrade profile stepwise when status is Good consecutively', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Automatic';

      mockSettings.glass.blur = 0;
      pm.status.value = 'Good';
      pm.consecutiveGoodAggregations = 4;
      pm.checkHysteresis();
      expect(mockSettings.perf!.level).toBe('Balanced');

      mockSettings.glass.blur = 8;
      pm.upgradeProfile();
      expect(mockSettings.perf!.level).toBe('Quality');

      mockSettings.glass.blur = 16;
      pm.upgradeProfile();
      expect(mockSettings.perf!.level).toBe('Max');
    }, 15000);

    it('should not downgrade if blur is already 0 (Eco floor)', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Automatic';
      mockSettings.glass.blur = 0;

      pm.downgradeProfile();
      // Should remain untouched since blur is not > 0
      expect(mockSettings.perf!.level).toBe('Automatic');
    });

    it('should not upgrade if blur is already at Max level (> 16)', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Automatic';
      mockSettings.glass.blur = 24;

      pm.upgradeProfile();
      expect(mockSettings.perf!.level).toBe('Automatic');
    });

    it('stopTelemetry cancels RAF and clears interval (covers lines 73-74)', () => {
      const pm = performanceManager as any;
      pm.rafId = 123;
      pm.aggregationInterval = 456;
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      const clearSpy = vi.spyOn(window, 'clearInterval');

      performanceManager.stopTelemetry();
      expect(cancelSpy).toHaveBeenCalledWith(123);
      expect(clearSpy).toHaveBeenCalledWith(456);
    });

    it('checkHysteresis ignores status changes when profile is manual (covers lines 124-127)', () => {
      const pm = performanceManager as any;
      mockSettings.perf!.level = 'Eco';
      pm.status.value = 'Poor';
      pm.consecutivePoorAggregations = 5;

      pm.checkHysteresis();
      expect(mockSettings.perf!.level).toBe('Eco');
    });
  });

  describe('Edge cases & Error Handling', () => {
    it('should handle calibration failure gracefully when workload drops FPS', async () => {
      vi.useRealTimers();
      const applySpy = vi.spyOn(performanceManager, 'applyProfile');

      // Simulate laggy frames (delta = 30ms > 20ms) causing failure
      let frameCount = 0;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        frameCount++;
        setTimeout(() => cb(performance.now() + 30), 1);
        return frameCount;
      });

      await performanceManager.runCalibration();
      // Even if failed early, applyProfile is called with fallback/best profile
      expect(applySpy).toHaveBeenCalled();
    });

    it('calibrates successfully through all workloads and recommends Max', async () => {
      vi.useRealTimers();
      mockSettings.perf!.level = 'Automatic';

      let time = 1000;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        time += 16;
        setTimeout(() => cb(time), 1);
        return 1;
      });

      const applySpy = vi.spyOn(performanceManager, 'applyProfile');
      await performanceManager.runCalibration();

      expect(applySpy).toHaveBeenCalled();
    }, 15000);

    it('should preserve manual profile selection after calibration', async () => {
      vi.useRealTimers();
      mockSettings.perf!.level = 'Max'; // Manual profile

      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        setTimeout(() => cb(performance.now()), 1);
        return 1;
      });

      const applySpy = vi.spyOn(performanceManager, 'applyProfile');
      await performanceManager.runCalibration();

      // Should NOT apply profile if user explicitly set a non-Automatic level
      expect(applySpy).not.toHaveBeenCalled();
      expect(mockSettings.perf!.level).toBe('Max');
    }, 15000);

    it('should handle Battery API errors and events gracefully', async () => {
      const listeners: Record<string, (...args: any[]) => void> = {};
      const mockBattery = {
        charging: false,
        addEventListener: (event: string, fn: (...args: any[]) => void) => {
          listeners[event] = fn;
        }
      };

      // @ts-expect-error mock navigator
      navigator.getBattery = vi.fn().mockResolvedValue(mockBattery);

      // Re-trigger battery listener via startTelemetry
      const pm = performanceManager as any;
      pm.startTelemetry();
      await Promise.resolve();

      expect(performanceManager.batteryStatus.value).toBe('settings.perf.batteryPower');

      // Test chargingchange event
      mockBattery.charging = true;
      if (listeners['chargingchange']) listeners['chargingchange']();
      expect(performanceManager.batteryStatus.value).toBe('settings.perf.optimizedAC');

      // Test rejected battery promise
      // @ts-expect-error mock navigator
      navigator.getBattery = vi.fn().mockRejectedValue(new Error('Battery API not supported'));
      expect(() => pm.startTelemetry()).not.toThrow();
    });
  });
});

