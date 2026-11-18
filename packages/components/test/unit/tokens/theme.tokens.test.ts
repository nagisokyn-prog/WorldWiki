import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME_PALETTE, withAlpha, toHex, applyHexWithCurrentAlpha } from '../../../src/ts/tokens/theme.tokens';

describe('theme.tokens', () => {
  describe('withAlpha', () => {
    it('handles empty color string', () => {
      expect(withAlpha('', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('clamps alpha between 0 and 1', () => {
      expect(withAlpha('', -1)).toBe('rgba(255, 255, 255, 0)');
      expect(withAlpha('', 2)).toBe('rgba(255, 255, 255, 1)');
    });

    it('converts 3-digit and 6-digit hex colors', () => {
      expect(withAlpha('#abc', 0.4)).toBe('rgba(170, 187, 204, 0.4)');
      expect(withAlpha('#112233', 0.8)).toBe('rgba(17, 34, 51, 0.8)');
      expect(withAlpha('#zz0000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('replaces alpha in rgb/rgba strings and returns unknown strings as-is', () => {
      expect(withAlpha('rgb(10, 20, 30)', 0.25)).toBe('rgba(10, 20, 30, 0.25)');
      expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.1)).toBe('rgba(10, 20, 30, 0.1)');
      expect(withAlpha('transparent', 0.5)).toBe('transparent');
    });
  });

  describe('toHex', () => {
    it('handles empty, hex, rgba, and invalid strings', () => {
      expect(toHex('')).toBe(DEFAULT_THEME_PALETTE.fallbackBlack);
      expect(toHex('#ff00aa88')).toBe('#ff00aa');
      expect(toHex('rgba(255, 16, 0, 0.5)')).toBe('#ff1000');
      expect(toHex('rgba(invalid)')).toBe(DEFAULT_THEME_PALETTE.fallbackBlack);
      expect(toHex('red')).toBe(DEFAULT_THEME_PALETTE.fallbackBlack);
    });
  });

  describe('applyHexWithCurrentAlpha', () => {
    it('preserves alpha from rgba current value and defaults to 1 otherwise', () => {
      expect(applyHexWithCurrentAlpha('rgba(0, 0, 0, 0.45)', '#102030')).toBe('rgba(16, 32, 48, 0.45)');
      expect(applyHexWithCurrentAlpha('rgba(0, 0, 0)', '#102030')).toBe('rgba(16, 32, 48, 1)');
      expect(applyHexWithCurrentAlpha('#000000', '#102030')).toBe('rgba(16, 32, 48, 1)');
    });
  });
});
