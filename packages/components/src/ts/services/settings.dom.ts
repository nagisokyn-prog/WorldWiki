import type { AppSettings } from '../types/settings';
import { withAlpha } from './settings.defaults';
import { applyCustomBackground } from './settings.background';

export function applySettingsToDOM(settings: AppSettings): void {
  const root = document.documentElement;
  if (!root) return;
  const s = settings;

  applyCustomBackground(settings);

  // Inverted logic: Transparency (0.0 = 0% прозрачности / сплошной, 1.0 = 100% прозрачности / стекло)
  const islandOpacity = +(Math.max(0, Math.min(1, 1 - (s.glass.islandAlpha ?? 0.55)))).toFixed(2);
  const cardOpacity = +(Math.max(0, Math.min(1, 1 - (s.glass.cardAlpha ?? 0.95)))).toFixed(2);
  const borderOpacity = +(Math.max(0, Math.min(1, 1 - (s.glass.borderAlpha ?? 0.9)))).toFixed(2);

  const panelBgWithAlpha = withAlpha(s.colors.bgPanel, islandOpacity);
  const cardBgWithAlpha = withAlpha(s.colors.bgInput || s.colors.bgSecondary, cardOpacity);
  const inputBgWithAlpha = (s.colors.bgInput && s.colors.bgInput.startsWith('rgba'))
    ? s.colors.bgInput
    : withAlpha(s.colors.bgInput, cardOpacity);
  const borderWithAlpha = withAlpha(s.colors.borderColor || '#ffffff', borderOpacity);

  // Определяем семантические токены оверлея и подложек
  const bgBaseStr = (s.colors.bgBase || '').toLowerCase();
  const isLightTheme = bgBaseStr.startsWith('#f') || bgBaseStr.startsWith('#e') || bgBaseStr === 'white';
  const modalBackdrop = isLightTheme ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0, 0, 0, 0.65)';
  const bgSunken = isLightTheme ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.25)';

  // Colors
  root.style.setProperty('--bg-base', s.colors.bgBase);
  root.style.setProperty('--bg-secondary', s.colors.bgSecondary);
  root.style.setProperty('--bg-panel', panelBgWithAlpha);
  root.style.setProperty('--bg-card', cardBgWithAlpha);
  root.style.setProperty('--bg-input', inputBgWithAlpha);
  root.style.setProperty('--bg-sunken', bgSunken);
  root.style.setProperty('--modal-backdrop', modalBackdrop);
  root.style.setProperty('--text-main', s.colors.textMain);
  root.style.setProperty('--text-muted', s.colors.textMuted);
  root.style.setProperty('--text-heading', s.colors.textHeading);
  root.style.setProperty('--accent', s.colors.accent);
  root.style.setProperty('--accent-hover', s.colors.accentHover);
  root.style.setProperty('--accent-active', s.colors.accentActive);
  root.style.setProperty('--accent-disabled', s.colors.accentDisabled);
  root.style.setProperty('--accent-glow', s.colors.accentGlow);
  root.style.setProperty('--accent-text', s.colors.accentText || '#ffffff');
  root.style.setProperty('--border-color', borderWithAlpha);
  root.style.setProperty('--border-active', s.colors.borderActive);
  root.style.setProperty('--shadow-color', s.colors.shadowColor);

  // Glass
  root.style.setProperty('--glass-bg', panelBgWithAlpha);
  root.style.setProperty('--glass-card', cardBgWithAlpha);
  root.style.setProperty('--glass-island-alpha', String(islandOpacity));
  root.style.setProperty('--glass-card-alpha', String(cardOpacity));
  root.style.setProperty('--glass-blur', `${s.glass.blur}px`);
  root.style.setProperty('--glass-border-alpha', String(borderOpacity));
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

  // Dropdowns
  const dropdownTransparency = s.dropdowns?.transparency ?? 0;
  const dropdownOpacity = +(Math.max(0, Math.min(1, 1 - dropdownTransparency / 100))).toFixed(2);
  const dropdownBgWithAlpha = withAlpha(s.colors.bgPanel || s.colors.bgBase || '#0f0f14', dropdownOpacity);

  root.style.setProperty('--dropdown-transparency', `${dropdownTransparency}%`);
  root.style.setProperty('--dropdown-opacity', String(dropdownOpacity));
  root.style.setProperty('--dropdown-bg', dropdownBgWithAlpha);

  // Apply logical UI settings as classes and attributes to body
  const body = document.body;
  body.classList.toggle('no-glass-blur', Number(s.glass.blur) === 0);
  body.classList.toggle('shadows-inset', s.shadows.useInset);
  body.classList.toggle('animations-pulse', s.animations.pulse);
  body.classList.toggle('focus-mode', s.layout.focusMode);

  body.setAttribute('data-input-style', s.inputs.style);
  body.setAttribute('data-toast-pos', s.notifications?.position || 'bottom-right');
  body.setAttribute('data-tab-pos', s.layout?.tabPos || 'row');
  body.classList.toggle('input-focus-anim', s.inputs.focusAnim);
  body.classList.toggle('btn-hover-scale', s.buttons.hoverScale);
  body.classList.toggle('btn-click-press', s.buttons.clickPress);
  body.classList.toggle('dropdown-3d-wheel', s.dropdowns.use3DWheel);
  body.classList.toggle('cards-compact', s.cards.compactList);
  body.classList.toggle('cards-show-icons', s.cards.showIcons);
  body.classList.toggle('editor-word-count', s.editor.showWordCount);
}
