import { describe, it, expect, vi } from 'vitest';
import { useSettingsAppearance } from '../useSettingsAppearance';
import type { AppSettings } from '../../../../ts/types/settings';

describe('useSettingsAppearance', () => {
  const createMockSettings = (): AppSettings => ({
    theme: 'dark',
    colors: {
      bgBase: '#09090b',
      bgSecondary: '#121214',
      bgPanel: 'rgba(15, 15, 18, 0.7)',
      bgInput: 'rgba(22, 22, 26, 0.6)',
      textMain: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.65)',
      textHeading: '#ffffff',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      accentActive: '#6d28d9',
      accentDisabled: '#4c1d95',
      accentGlow: 'rgba(139, 92, 246, 0.3)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderActive: 'rgba(139, 92, 246, 0.5)',
      shadowColor: 'rgba(0, 0, 0, 0.5)',
    },
    glass: {
      islandAlpha: 0.7,
      cardAlpha: 0.6,
      blur: 24,
      borderAlpha: 0.12,
      highlight: 'rgba(255, 255, 255, 0.08)',
    },
    background: {
      type: 'color',
      opacity: 1,
      blur: 0,
      fit: 'cover',
    },
    radii: { island: 28, card: 20, btn: 40, input: 16, dropdown: 16 },
    shadows: { islandY: 20, islandBlur: 35, useInset: false },
    animations: { enabled: true, speed: 0.3, entrance: 0.4, pulse: true, scalePush: 0.98, scalePull: 1.05 },
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
    perf: { level: 'auto', fpsLimit: 60, loadMeter: 0 },
  } as AppSettings);

  it('calculates transparency percent inversely from alpha (0% = opaque, 100% = clear)', () => {
    const mock = createMockSettings();
    const { getTransparencyPercent } = useSettingsAppearance(() => mock);

    expect(getTransparencyPercent(1.0)).toBe(0); // 1.0 alpha = 0% transparency
    expect(getTransparencyPercent(0.0)).toBe(100); // 0.0 alpha = 100% transparency
    expect(getTransparencyPercent(0.7)).toBe(30); // 0.7 alpha = 30% transparency
    expect(getTransparencyPercent(0.25)).toBe(75); // 0.25 alpha = 75% transparency
    expect(getTransparencyPercent(undefined, 0.8)).toBe(20);
  });

  it('calculates transparency slider value (0..1) inversely from alpha', () => {
    const mock = createMockSettings();
    const { getTransparencyValue } = useSettingsAppearance(() => mock);

    expect(getTransparencyValue(1.0)).toBe(0);
    expect(getTransparencyValue(0.0)).toBe(1);
    expect(getTransparencyValue(0.7)).toBe(0.3);
    expect(getTransparencyValue(undefined, 0.6)).toBe(0.4);
  });

  it('sets alpha inversely when transparency slider value is changed', () => {
    const mock = createMockSettings();
    const saveSpy = vi.fn();
    const { setTransparency } = useSettingsAppearance(() => mock, saveSpy);

    let alphaVal = 0;
    const setter = (val: number) => { alphaVal = val; };

    // Setting 0% transparency -> alpha should be 1.0 (fully opaque)
    setTransparency(setter, 0);
    expect(alphaVal).toBe(1.0);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Setting 100% transparency -> alpha should be 0.0 (fully transparent)
    setTransparency(setter, 1.0);
    expect(alphaVal).toBe(0.0);

    // Setting 30% transparency -> alpha should be 0.7
    setTransparency(setter, 0.3);
    expect(alphaVal).toBe(0.7);

    // Clamps values out of range
    setTransparency(setter, 1.5);
    expect(alphaVal).toBe(0.0);
    setTransparency(setter, -0.5);
    expect(alphaVal).toBe(1.0);
  });

  it('updates color hex while preserving alpha', () => {
    const mock = createMockSettings();
    const saveSpy = vi.fn();
    const { updateColorAlpha } = useSettingsAppearance(() => mock, saveSpy);

    updateColorAlpha('bgPanel', '#ff0000');
    expect(mock.colors.bgPanel).toBe('rgba(255, 0, 0, 0.7)');
    expect(saveSpy).toHaveBeenCalled();
  });

  it('sets background type and safely handles uninitialized background object', () => {
    const mock = createMockSettings();
    delete (mock as any).background;
    const saveSpy = vi.fn();
    const { setBackgroundType } = useSettingsAppearance(() => mock, saveSpy);

    setBackgroundType('image');
    expect(mock.background?.type).toBe('image');
    expect(mock.background?.fit).toBe('cover');
    expect(saveSpy).toHaveBeenCalled();

    setBackgroundType('color');
    expect(mock.background?.type).toBe('color');
  });

  it('sets background opacity inversely as transparency', () => {
    const mock = createMockSettings();
    delete (mock as any).background;
    const saveSpy = vi.fn();
    const { setBackgroundOpacity } = useSettingsAppearance(() => mock, saveSpy);

    // Set 20% transparency -> opacity should be 0.8
    setBackgroundOpacity(0.2);
    expect(mock.background?.opacity).toBe(0.8);
    expect(saveSpy).toHaveBeenCalled();
  });
});
