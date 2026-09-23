/**
 * @file settings.dom.ts
 * @description Применение настроек интерфейса к DOM-дереву и CSS-переменным
 */

import type { AppSettings } from '../types/settings';
import { applyCustomBackground } from './settings.background';

/**
 * Применяет параметры темы, шрифты, отступы, анимации и CSS-переменные к корневому элементу DOM
 */
export function applySettingsToDOM(settings: AppSettings): void {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  const root = document.documentElement;
  const style = root.style;

  // 1. Атрибуты темы (активируют CSS-токены темы в :root[data-theme="..."])
  if (settings.theme) {
    root.setAttribute('data-theme', settings.theme);
  }

  // 2. Цвета темы (пользовательские оверрайды из настроек)
  if (settings.colors) {
    const c = settings.colors;
    if (c.bgBase) {
      style.setProperty('--bg-base', c.bgBase);
      style.setProperty('--bg-main', c.bgBase);
    }
    if (c.bgSecondary) style.setProperty('--bg-secondary', c.bgSecondary);
    if (c.bgPanel) style.setProperty('--bg-panel', c.bgPanel);
    if (c.bgCard) style.setProperty('--bg-card', c.bgCard);
    if (c.bgInput) style.setProperty('--bg-input', c.bgInput);
    if (c.bgSunken) style.setProperty('--bg-sunken', c.bgSunken);
    if (c.bgHover) style.setProperty('--bg-hover', c.bgHover);
    if (c.bgActive) style.setProperty('--bg-active', c.bgActive);
    if (c.bgSelected) style.setProperty('--bg-selected', c.bgSelected);
    if (c.modalBackdrop) style.setProperty('--modal-backdrop', c.modalBackdrop);
    if (c.textMain) style.setProperty('--text-main', c.textMain);
    if (c.textMuted) style.setProperty('--text-muted', c.textMuted);
    if (c.textHeading) style.setProperty('--text-heading', c.textHeading);
    if (c.textDisabled) style.setProperty('--text-disabled', c.textDisabled);
    if (c.accent) style.setProperty('--accent', c.accent);
    if (c.accentHover) style.setProperty('--accent-hover', c.accentHover);
    if (c.accentActive) style.setProperty('--accent-active', c.accentActive);
    if (c.accentDisabled) style.setProperty('--accent-disabled', c.accentDisabled);
    if (c.accentGlow) style.setProperty('--accent-glow', c.accentGlow);
    if (c.accentText) style.setProperty('--accent-text', c.accentText);
    if (c.borderColor) style.setProperty('--border-color', c.borderColor);
    if (c.borderActive) style.setProperty('--border-active', c.borderActive);
    if (c.shadowColor) style.setProperty('--shadow-color', c.shadowColor);
  }

  // 3. Glass-эффекты
  if (settings.glass) {
    const g = settings.glass;
    if (g.islandAlpha !== undefined) style.setProperty('--glass-island-alpha', String(g.islandAlpha));
    if (g.cardAlpha !== undefined) style.setProperty('--glass-card-alpha', String(g.cardAlpha));
    if (g.blur !== undefined) style.setProperty('--glass-blur', `${g.blur}px`);
    if (g.borderAlpha !== undefined) style.setProperty('--glass-border-alpha', String(g.borderAlpha));
    if (g.highlight) style.setProperty('--glass-highlight', g.highlight);
  }

  // 3. Радиусы скругления
  if (settings.radii) {
    const r = settings.radii;
    if (r.island !== undefined) style.setProperty('--radius-island', `${r.island}px`);
    if (r.card !== undefined) style.setProperty('--radius-card', `${r.card}px`);
    if (r.btn !== undefined) style.setProperty('--radius-btn', `${r.btn}px`);
    if (r.input !== undefined) style.setProperty('--radius-input', `${r.input}px`);
    if (r.dropdown !== undefined) style.setProperty('--radius-dropdown', `${r.dropdown}px`);
  }

  // 4. Тени
  if (settings.shadows) {
    const s = settings.shadows;
    if (s.islandY !== undefined) style.setProperty('--shadow-island-y', `${s.islandY}px`);
    if (s.islandBlur !== undefined) style.setProperty('--shadow-island-blur', `${s.islandBlur}px`);
  }

  // 5. Анимации
  if (settings.animations) {
    const a = settings.animations;
    if (a.speed !== undefined) style.setProperty('--anim-speed', `${a.speed}s`);
    if (a.ease) style.setProperty('--anim-ease', a.ease);
    if (a.entrance !== undefined) style.setProperty('--anim-entrance', `${a.entrance}s`);
    if (a.scalePush !== undefined) style.setProperty('--anim-scale-push', String(a.scalePush));
    if (a.scalePull !== undefined) style.setProperty('--anim-scale-pull', String(a.scalePull));
    root.setAttribute('data-animations', String(a.enabled ?? true));
  }

  // 6. Шрифты
  if (settings.fonts) {
    const f = settings.fonts;
    if (f.family) style.setProperty('--font-family', f.family);
    if (f.size !== undefined) style.setProperty('--font-size', `${f.size}px`);
    if (f.weight !== undefined) style.setProperty('--font-weight', String(f.weight));
    if (f.weightBold !== undefined) style.setProperty('--font-weight-bold', String(f.weightBold));
    if (f.lineHeight !== undefined) style.setProperty('--line-height', String(f.lineHeight));
    if (f.letterSpacing !== undefined) style.setProperty('--letter-spacing', `${f.letterSpacing}px`);
  }

  // 7. Отступы и размеры
  if (settings.spacing) {
    const sp = settings.spacing;
    if (sp.density !== undefined) style.setProperty('--spacing-density', String(sp.density));
    if (sp.sidebarWidth !== undefined) style.setProperty('--sidebar-width', `${sp.sidebarWidth}px`);
    if (sp.panelHeight !== undefined) style.setProperty('--panel-height', `${sp.panelHeight}px`);
    if (sp.activityBarWidth !== undefined) style.setProperty('--activity-bar-width', `${sp.activityBarWidth}px`);
    if (sp.toolbarHeight !== undefined) style.setProperty('--toolbar-height', `${sp.toolbarHeight}px`);
    if (sp.gap !== undefined) style.setProperty('--spacing-gap', `${sp.gap}px`);
  }

  // 8. Компоновка (Layout)
  if (settings.layout) {
    const l = settings.layout;
    if (l.columns !== undefined) {
      style.setProperty('--layout-columns', String(l.columns));
      root.setAttribute('data-layout-columns', String(l.columns));
    }
    if (l.sidebarPos) {
      style.setProperty('--sidebar-pos', l.sidebarPos);
      root.setAttribute('data-sidebar-pos', l.sidebarPos);
    }
    if (l.focusMode !== undefined) {
      root.setAttribute('data-focus-mode', String(l.focusMode));
    }
  }

  // 9. Вкладки (Tabs)
  if (settings.tabs) {
    if (settings.tabs.pos) {
      style.setProperty('--tab-pos', settings.tabs.pos);
      root.setAttribute('data-tab-pos', settings.tabs.pos);
    }
  }

  // 10. Кнопки (Buttons)
  if (settings.buttons) {
    const b = settings.buttons;
    if (b.hoverScale !== undefined) {
      root.setAttribute('data-btn-hover-scale', String(b.hoverScale));
      root.classList.toggle('btn-hover-scale', b.hoverScale);
    }
    if (b.clickPress !== undefined) {
      root.setAttribute('data-btn-click-press', String(b.clickPress));
      root.classList.toggle('btn-click-press', b.clickPress);
    }
  }

  // 11. Уведомления (Notifications)
  if (settings.notifications) {
    const n = settings.notifications;
    if (n.position) {
      root.setAttribute('data-toast-pos', n.position);
    }
  }

  // 12. Инпуты (Inputs)
  if (settings.inputs?.style) {
    root.setAttribute('data-input-style', settings.inputs.style);
  }

  // 13. Пользовательский фон
  applyCustomBackground(settings);
}
