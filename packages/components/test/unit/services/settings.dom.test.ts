import { describe, it, expect, beforeEach } from 'vitest';
import { applySettingsToDOM, extractRgb, toRgbaString } from '../../../src/ts/services/settings.dom';
import type { AppSettings } from '../../../src/ts/types/settings';
import darkTheme from '@worldwiki/resources/themes/dark.theme.json';
import lightTheme from '@worldwiki/resources/themes/light.theme.json';

describe('settings.dom color extraction and dynamic calculation', () => {
  it('extracts RGB from 6-digit hex (#09090b)', () => {
    expect(extractRgb('#09090b')).toEqual([9, 9, 11]);
    expect(extractRgb('#ffffff')).toEqual([255, 255, 255]);
  });

  it('extracts RGB from 3-digit hex (#fff)', () => {
    expect(extractRgb('#fff')).toEqual([255, 255, 255]);
  });

  it('extracts RGB from rgba string', () => {
    expect(extractRgb('rgba(22, 22, 26, 0.6)')).toEqual([22, 22, 26]);
    expect(extractRgb('rgb(15, 15, 18)')).toEqual([15, 15, 18]);
  });

  it('returns null on invalid string', () => {
    expect(extractRgb('')).toBeNull();
    expect(extractRgb('invalid-color')).toBeNull();
  });

  it('toRgbaString creates valid rgba string with target alpha', () => {
    expect(toRgbaString('#09090b', 0.5, [0, 0, 0])).toBe('rgba(9, 9, 11, 0.5)');
    expect(toRgbaString('rgba(22, 22, 26, 0.9)', 0.4, [0, 0, 0])).toBe('rgba(22, 22, 26, 0.4)');
  });
});

describe('applySettingsToDOM', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies dark theme JSON tokens to root element', () => {
    const settings = {
      theme: 'dark',
      ...darkTheme,
    } as unknown as AppSettings;

    applySettingsToDOM(settings);

    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(style.getPropertyValue('--bg-card')).toBe('rgba(22, 22, 26, 0.6)');
    expect(style.getPropertyValue('--glass-card-alpha')).toBe('0.6');
    expect(style.getPropertyValue('--glass-island-alpha')).toBe('0.7');
    expect(style.getPropertyValue('--bg-card-rgb')).toBe('22, 22, 26');
  });

  it('dynamically recalculates --bg-card and --glass-card when cardAlpha changes', () => {
    const settings = {
      theme: 'dark',
      ...darkTheme,
      glass: {
        ...darkTheme.glass,
        cardAlpha: 0.25,
      },
    } as unknown as AppSettings;

    applySettingsToDOM(settings);

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--glass-card-alpha')).toBe('0.25');
    expect(style.getPropertyValue('--bg-card')).toBe('rgba(22, 22, 26, 0.25)');
    expect(style.getPropertyValue('--glass-card')).toBe('rgba(22, 22, 26, 0.25)');
  });

  it('applies light theme JSON tokens and dynamically calculates card background', () => {
    const settings = {
      theme: 'light',
      ...lightTheme,
    } as unknown as AppSettings;

    applySettingsToDOM(settings);

    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(style.getPropertyValue('--bg-card')).toBe('rgba(255, 255, 255, 0.85)');
    expect(style.getPropertyValue('--glass-card-alpha')).toBe('0.85');
    expect(style.getPropertyValue('--bg-card-rgb')).toBe('255, 255, 255');
  });
});
