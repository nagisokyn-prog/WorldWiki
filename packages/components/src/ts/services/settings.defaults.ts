import type { AppSettings } from '../types/settings';

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'ru',
  colors: {
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
    shadowColor: 'rgba(0,0,0,0.5)'
  },
  glass: { islandAlpha: 0.55, cardAlpha: 0.95, blur: 24, borderAlpha: 0.9, highlight: 'rgba(255,255,255,0.08)' },
  radii: { island: 28, card: 20, btn: 40, input: 16, dropdown: 16 },
  shadows: { islandY: 20, islandBlur: 35, useInset: false },
  animations: { enabled: true, speed: 0.3, ease: 'cubic-bezier(0.2,0.8,0.2,1)', entrance: 0.4, pulse: true, scalePush: 0.98, scalePull: 1.05 },
  fonts: { family: 'Inter', size: 14, weight: 400, weightBold: 600, lineHeight: 1.5, letterSpacing: 0 },
  spacing: { density: 1, sidebarWidth: 280, panelHeight: 250, activityBarWidth: 60, toolbarHeight: 48, gap: 16 },
  layout: { columns: 2, sidebarPos: 'row', tabPos: 'row', focusMode: false },
  inputs: { style: 'outline', focusAnim: true },
  buttons: { hoverScale: true, clickPress: true },
  tabs: { pos: 'row' },
  dropdowns: { use3DWheel: true, wheelOrientation: 'vertical', transparency: 0 },
  cards: { compactList: false, showIcons: true },
  editor: { showWordCount: true, requireCtrlForLinks: false, autoSaveInterval: 60, snapshotInterval: 15, maxSnapshots: 10 },
  notifications: { duration: 3000, position: 'bottom-right' },
  perf: { level: 'auto', fpsLimit: 60, loadMeter: 0, qualityLevel: 100 },
  background: { type: 'none', opacity: 1, blur: 0, fit: 'cover', fpsLimit: 30 }
};

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
