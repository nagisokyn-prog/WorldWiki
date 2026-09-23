/**
 * @file settings.dom.ts
 * @description Применение настроек интерфейса к DOM-дереву и CSS-переменным
 */

import type { AppSettings } from '../types/settings';
import { applyCustomBackground } from './settings.background';

/**
 * Извлекает компоненты [r, g, b] из hex-строки (#ffffff) или rgba-строки (rgba(255, 255, 255, 0.5))
 */
export function extractRgb(colorStr?: string): [number, number, number] | null {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }
  const match = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return null;
}

/**
 * Создает rgba-строку с заданной прозрачностью на основе исходного цвета
 */
export function toRgbaString(colorStr: string | undefined, alpha: number, fallbackRgb: [number, number, number]): string {
  const rgb = extractRgb(colorStr) || fallbackRgb;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampedAlpha})`;
}

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

  const g = settings.glass || {};
  const c = settings.colors || {};

  // Извлекаем или берем дефолты альфа-каналов
  const cardAlpha = g.cardAlpha !== undefined ? g.cardAlpha : 0.6;
  const islandAlpha = g.islandAlpha !== undefined ? g.islandAlpha : 0.7;
  const borderAlpha = g.borderAlpha !== undefined ? g.borderAlpha : 0.12;

  // 2. Glass-эффекты
  style.setProperty('--glass-card-alpha', String(cardAlpha));
  style.setProperty('--glass-island-alpha', String(islandAlpha));
  style.setProperty('--glass-border-alpha', String(borderAlpha));
  if (g.blur !== undefined) style.setProperty('--glass-blur', `${g.blur}px`);
  if (g.highlight) style.setProperty('--glass-highlight', g.highlight);

  // 3. Динамический расчет цветов карточек, панелей и фонов
  const bgCardRgb = extractRgb(c.bgCard) || [22, 22, 26];
  const bgPanelRgb = extractRgb(c.bgPanel) || [15, 15, 18];
  const bgInputRgb = extractRgb(c.bgInput) || [22, 22, 26];

  style.setProperty('--bg-card-rgb', `${bgCardRgb[0]}, ${bgCardRgb[1]}, ${bgCardRgb[2]}`);
  style.setProperty('--bg-panel-rgb', `${bgPanelRgb[0]}, ${bgPanelRgb[1]}, ${bgPanelRgb[2]}`);
  style.setProperty('--bg-input-rgb', `${bgInputRgb[0]}, ${bgInputRgb[1]}, ${bgInputRgb[2]}`);

  // Динамические фоны, зависимые от альфа-канала
  const computedBgCard = toRgbaString(c.bgCard, cardAlpha, [22, 22, 26]);
  const computedBgPanel = toRgbaString(c.bgPanel, islandAlpha, [15, 15, 18]);
  const computedGlassBg = toRgbaString(c.bgPanel, islandAlpha, [20, 20, 25]);
  const computedBgInput = c.bgInput ? toRgbaString(c.bgInput, 0.6, [22, 22, 26]) : 'rgba(22, 22, 26, 0.6)';

  style.setProperty('--bg-card', computedBgCard);
  style.setProperty('--glass-card', computedBgCard);
  style.setProperty('--bg-panel', computedBgPanel);
  style.setProperty('--glass-bg', computedGlassBg);
  style.setProperty('--bg-input', computedBgInput);

  if (c.bgBase) {
    style.setProperty('--bg-base', c.bgBase);
    style.setProperty('--bg-main', c.bgBase);
  }
  if (c.bgSecondary) {
    style.setProperty('--bg-secondary', toRgbaString(c.bgSecondary, 0.8, [18, 18, 20]));
  }
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
    if (a.enabled === false) {
      style.setProperty('--anim-speed', '0s');
      style.setProperty('--anim-entrance', '0s');
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('animations-disabled');
      }
    } else {
      if (a.speed !== undefined) style.setProperty('--anim-speed', `${a.speed}s`);
      if (a.entrance !== undefined) style.setProperty('--anim-entrance', `${a.entrance}s`);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('animations-disabled');
      }
    }
    if (a.ease) style.setProperty('--anim-ease', a.ease);
    if (a.scalePush !== undefined) style.setProperty('--anim-scale-push', String(a.scalePush));
    if (a.scalePull !== undefined) style.setProperty('--anim-scale-pull', String(a.scalePull));
    root.setAttribute('data-animations', String(a.enabled ?? true));
  }

  // 6. Шрифты
  if (settings.fonts) {
    const f = settings.fonts;
    if (f.family) {
      style.setProperty('--font-family', f.family);
    }
    if (f.size !== undefined) {
      style.setProperty('--font-size', `${f.size}px`);
      style.setProperty('--font-size-base', `${f.size}px`);
    }
    if (f.weight !== undefined) {
      style.setProperty('--font-weight', String(f.weight));
      style.setProperty('--font-weight-base', String(f.weight));
    }
    if (f.weightBold !== undefined) {
      style.setProperty('--font-weight-bold', String(f.weightBold));
    }
    if (f.lineHeight !== undefined) {
      style.setProperty('--line-height', String(f.lineHeight));
      style.setProperty('--line-height-base', String(f.lineHeight));
    }
    if (f.letterSpacing !== undefined) {
      style.setProperty('--letter-spacing', `${f.letterSpacing}px`);
      style.setProperty('--letter-spacing-base', `${f.letterSpacing}px`);
    }
  }

  // 7. Отступы и размеры
  if (settings.spacing) {
    const sp = settings.spacing;
    if (sp.density !== undefined) {
      style.setProperty('--spacing-density', String(sp.density));
      style.setProperty('--density-mult', String(sp.density));
    }
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
    }
    if (b.clickPress !== undefined) {
      root.setAttribute('data-btn-click-press', String(b.clickPress));
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

  // 13. Выпадающие списки (Dropdowns)
  if (settings.dropdowns?.transparency !== undefined) {
    const t = settings.dropdowns.transparency;
    const op = ((100 - t) / 100).toFixed(1);
    style.setProperty('--dropdown-transparency', `${t}%`);
    style.setProperty('--dropdown-opacity', op);
    style.setProperty('--dropdown-bg', `rgba(15, 15, 20, ${op})`);
  }

  // 14. Классы на document.body для стилизации
  if (typeof document !== 'undefined' && document.body) {
    const body = document.body;
    if (settings.shadows?.useInset !== undefined) body.classList.toggle('shadows-inset', settings.shadows.useInset);
    if (settings.animations?.pulse !== undefined) body.classList.toggle('animations-pulse', settings.animations.pulse);
    if (settings.layout?.focusMode !== undefined) body.classList.toggle('focus-mode', settings.layout.focusMode);
    if (settings.inputs?.style) body.setAttribute('data-input-style', settings.inputs.style);
    if (settings.inputs?.focusAnim !== undefined) body.classList.toggle('input-focus-anim', settings.inputs.focusAnim);
    if (settings.buttons?.hoverScale !== undefined) body.classList.toggle('btn-hover-scale', settings.buttons.hoverScale);
    if (settings.buttons?.clickPress !== undefined) body.classList.toggle('btn-click-press', settings.buttons.clickPress);
    if (settings.dropdowns?.use3DWheel !== undefined) body.classList.toggle('dropdown-3d-wheel', settings.dropdowns.use3DWheel);
    if (settings.cards?.compactList !== undefined) body.classList.toggle('cards-compact', settings.cards.compactList);
    if (settings.cards?.showIcons !== undefined) body.classList.toggle('cards-show-icons', settings.cards.showIcons);
    if (settings.editor?.showWordCount !== undefined) body.classList.toggle('editor-word-count', settings.editor.showWordCount);
  }

  // 15. Пользовательский фон
  applyCustomBackground(settings);
}

