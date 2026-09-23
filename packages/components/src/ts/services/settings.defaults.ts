import type { AppSettings } from '../types/settings';
import { DEFAULT_THEME_PALETTE } from '../tokens/theme.tokens';

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'ru',
  colors: {
    bgBase: DEFAULT_THEME_PALETTE.bgBase,
    bgSecondary: DEFAULT_THEME_PALETTE.bgSecondary,
    bgPanel: DEFAULT_THEME_PALETTE.bgPanel,
    bgInput: DEFAULT_THEME_PALETTE.bgInput,
    textMain: DEFAULT_THEME_PALETTE.textMain,
    textMuted: DEFAULT_THEME_PALETTE.textMuted,
    textHeading: DEFAULT_THEME_PALETTE.textHeading,
    accent: DEFAULT_THEME_PALETTE.accent,
    accentHover: DEFAULT_THEME_PALETTE.accentHover,
    accentActive: DEFAULT_THEME_PALETTE.accentActive,
    accentDisabled: DEFAULT_THEME_PALETTE.accentDisabled,
    accentGlow: DEFAULT_THEME_PALETTE.accentGlow,
    accentText: DEFAULT_THEME_PALETTE.accentText,
    borderColor: DEFAULT_THEME_PALETTE.borderColor,
    borderActive: DEFAULT_THEME_PALETTE.borderActive,
    shadowColor: DEFAULT_THEME_PALETTE.shadowColor
  },
  glass: { islandAlpha: 0.45, cardAlpha: 0.6, blur: 24, borderAlpha: 0.1, highlight: DEFAULT_THEME_PALETTE.glassHighlight },
  radii: { island: 28, card: 20, btn: 40, input: 16, dropdown: 16 },
  shadows: { islandY: 20, islandBlur: 35, useInset: false },
  animations: { enabled: true, speed: 0.3, ease: 'cubic-bezier(0.2,0.8,0.2,1)', entrance: 0.4, pulse: true, scalePush: 0.98, scalePull: 1.05 },
  fonts: { family: 'Inter, system-ui, sans-serif', size: 14, weight: 400, weightBold: 600, lineHeight: 1.5, letterSpacing: 0 },
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

export { withAlpha } from '../tokens/theme.tokens';
