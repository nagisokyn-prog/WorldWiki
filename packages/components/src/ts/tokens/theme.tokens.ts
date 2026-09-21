/**
 * Design Tokens: Theme & Color Palettes
 * Single Source of Truth for core theme colors, defaults and fallbacks.
 */

export const DEFAULT_THEME_PALETTE = {
  bgBase: '#09090b',
  bgSecondary: '#121214',
  bgPanel: 'rgba(15,15,18,0.7)',
  bgInput: 'rgba(22,22,26,0.6)',
  textMain: '#ffffff',
  textMuted: 'rgba(255,255,255,0.65)',
  textHeading: '#ffffff',
  accent: '#8b5cf6',
  accentHover: '#7c3aed',
  accentActive: '#6d28d9',
  accentDisabled: '#4c1d95',
  accentGlow: 'rgba(139,92,246,0.3)',
  accentText: '#ffffff',
  borderColor: 'rgba(255,255,255,0.1)',
  borderActive: 'rgba(139,92,246,0.5)',
  shadowColor: 'rgba(0,0,0,0.5)',
  glassHighlight: 'rgba(255,255,255,0.08)',
  fallbackBlack: '#000000',
  fallbackWhite: '#ffffff',
  dropdownFallback: '#0f0f14',
  modalBackdropLight: 'rgba(15, 23, 42, 0.45)',
  modalBackdropDark: 'rgba(0, 0, 0, 0.65)',
  bgSunkenLight: 'rgba(0, 0, 0, 0.04)',
  bgSunkenDark: 'rgba(0, 0, 0, 0.25)',
  previewShadowFallback: 'rgba(0, 0, 0, 0.3)'
} as const;

export type ThemePalette = typeof DEFAULT_THEME_PALETTE;

export function withAlpha(colorStr: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  if (!colorStr) return `rgba(255, 255, 255, ${clampedAlpha})`;

  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${clampedAlpha})`;
  }
  return colorStr;
}

export function toHex(colorStr: string): string {
  if (!colorStr) return DEFAULT_THEME_PALETTE.fallbackBlack;
  if (colorStr.startsWith('#')) return colorStr.substring(0, 7);
  if (colorStr.startsWith('rgba')) {
    const parts = colorStr.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0]).toString(16).padStart(2, '0');
      const g = parseInt(parts[1]).toString(16).padStart(2, '0');
      const b = parseInt(parts[2]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return DEFAULT_THEME_PALETTE.fallbackBlack;
}

export function applyHexWithCurrentAlpha(currentVal: string, hexCode: string): string {
  let alpha = '1';
  if (currentVal.startsWith('rgba')) {
    const parts = currentVal.match(/[\d.]+/g);
    if (parts && parts.length === 4) {
      alpha = parts[3];
    }
  }
  const r = parseInt(hexCode.slice(1, 3), 16);
  const g = parseInt(hexCode.slice(3, 5), 16);
  const b = parseInt(hexCode.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
