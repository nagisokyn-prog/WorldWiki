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
  dropdownFallback: '#0f0f14'
} as const;

export type ThemePalette = typeof DEFAULT_THEME_PALETTE;
