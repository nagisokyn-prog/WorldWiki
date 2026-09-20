/**
 * @file ui-helpers.ts
 * @description Утилиты для работы с UI компонентами
 * Интегрирует GSAP анимации, CSS-переменные и glassmorphism эффекты
 * @note DOM-зависимый, не rust-ready
 */

import { onScopeDispose } from 'vue';

// ==========================================================================
// 1. GSAP АНИМАЦИИ (PUSH/PULL ЭФФЕКТЫ)
// ==========================================================================

declare const gsap: {
  to: (target: unknown, vars: Record<string, unknown>) => unknown;
  fromTo: (target: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>) => unknown;
} | undefined;

export interface InteractiveOptions {
  pullScale?: number;
  pushScale?: number;
  duration?: number;
  ease?: string;
  pushDuration?: number;
}

/**
 * Инициализирует push/pull анимации для интерактивных элементов
 */
export function initInteractiveElements(
  selector: string | HTMLElement = '.interactive-el',
  options: InteractiveOptions = {}
): () => void {
  const {
    pullScale = 1.05,
    pushScale = 0.98,
    duration = 0.3,
    ease = 'power2.out',
    pushDuration = 0.1
  } = options;

  const elements = typeof selector === 'string'
    ? Array.from(document.querySelectorAll(selector)) as HTMLElement[]
    : [selector];

  const cleanups: Array<() => void> = [];

  elements.forEach(el => {
    if (!el) return;

    if (typeof gsap === 'undefined') {
      el.style.transition = `transform ${duration}s ease`;
      const onEnter = () => { el.style.transform = `scale(${pullScale})`; };
      const onLeave = () => { el.style.transform = 'scale(1)'; };
      const onDown = () => { el.style.transform = `scale(${pushScale})`; };
      const onUp = () => { el.style.transform = `scale(${pullScale})`; };

      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
        el.removeEventListener('mousedown', onDown);
        el.removeEventListener('mouseup', onUp);
      });
      return;
    }

    const onEnter = () => {
      gsap?.to(el, {
        scale: pullScale,
        duration,
        ease,
        zIndex: 20,
        overwrite: true
      });
    };

    const onLeave = () => {
      gsap?.to(el, {
        scale: 1,
        duration,
        ease,
        zIndex: 10,
        overwrite: true
      });
    };

    const onDown = () => {
      gsap?.to(el, {
        scale: pushScale,
        duration: pushDuration,
        overwrite: true
      });
    };

    const onUp = () => {
      gsap?.to(el, {
        scale: pullScale,
        duration: pushDuration,
        overwrite: true
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);

    cleanups.push(() => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
    });
  });

  return () => {
    cleanups.forEach(fn => fn());
  };
}

export function useInteractiveElements(
  selector: string | HTMLElement = '.interactive-el',
  options: InteractiveOptions = {}
): () => void {
  const cleanup = initInteractiveElements(selector, options);
  onScopeDispose(() => {
    cleanup();
  });
  return cleanup;
}

export interface AnimateOptions {
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
  stagger?: number;
  duration?: number;
  ease?: string;
  delay?: number;
}

/**
 * Stagger анимация для появления элементов
 */
export function animateEntrance(
  selector: string | HTMLElement[],
  options: AnimateOptions = {}
): void {
  const {
    from = { opacity: 0, y: 20 },
    to = { opacity: 1, y: 0 },
    stagger = 0.1,
    duration = 0.4,
    ease = 'power2.out',
    delay = 0
  } = options;

  if (typeof gsap === 'undefined') {
    console.warn('GSAP not loaded, skipping animation');
    return;
  }

  const elements = typeof selector === 'string'
    ? document.querySelectorAll(selector)
    : selector;

  gsap?.fromTo(elements, from, {
    ...to,
    duration,
    stagger,
    ease,
    delay
  });
}

/**
 * Анимация удаления элемента
 */
export function animateRemoval(element: HTMLElement, callback?: () => void): void {
  if (typeof gsap === 'undefined') {
    element.remove();
    callback?.();
    return;
  }

  gsap?.to(element, {
    opacity: 0,
    scale: 0.8,
    y: -20,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      element.remove();
      callback?.();
    }
  });
}

/**
 * Анимация появления/скрытия элемента
 */
export function toggleElement(element: HTMLElement, show: boolean = true): void {
  if (typeof gsap === 'undefined') {
    element.style.display = show ? '' : 'none';
    return;
  }

  if (show) {
    element.style.display = '';
    gsap?.fromTo(element,
      { opacity: 0, height: 0 },
      { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out' }
    );
  } else {
    gsap?.to(element, {
      opacity: 0,
      height: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        element.style.display = 'none';
      }
    });
  }
}

// ==========================================================================
// 2. УПРАВЛЕНИЕ CSS-ПЕРЕМЕННЫМИ
// ==========================================================================

/**
 * Установить CSS-переменную
 */
export function setCSSVariable(
  variable: string,
  value: string,
  element: HTMLElement = document.documentElement
): void {
  element.style.setProperty(variable, value);
}

/**
 * Получить значение CSS-переменной
 */
export function getCSSVariable(
  variable: string,
  element: HTMLElement = document.documentElement
): string {
  return getComputedStyle(element).getPropertyValue(variable).trim();
}

/**
 * Установить несколько CSS-переменных
 */
export function setCSSVariables(
  variables: Record<string, string>,
  element: HTMLElement = document.documentElement
): void {
  Object.entries(variables).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}

export interface VariableAnimateOptions {
  duration?: number;
  ease?: string;
  element?: HTMLElement;
}

/**
 * Анимация CSS-переменной через GSAP
 */
export function animateCSSVariable(
  variable: string,
  toValue: string,
  options: VariableAnimateOptions = {}
): void {
  const {
    duration = 0.5,
    ease = 'power2.out',
    element = document.documentElement
  } = options;

  if (typeof gsap === 'undefined') {
    setCSSVariable(variable, toValue, element);
    return;
  }

  gsap?.to(element, {
    duration,
    ease,
    onUpdate: () => {
      setCSSVariable(variable, toValue, element);
    }
  });
}

// ==========================================================================
// 3. GLASSMORPHISM ЭФФЕКТЫ
// ==========================================================================

export interface GlassCardOptions {
  className?: string;
  content?: string;
  interactive?: boolean;
  pushed?: boolean;
}

/**
 * Создать glass card контейнер
 */
export function createGlassCard(options: GlassCardOptions = {}): HTMLElement {
  const {
    className = '',
    content = '',
    interactive = true,
    pushed = false
  } = options;

  const container = document.createElement('div');
  container.className = `glass-card-container ${className} ${interactive ? 'interactive-el' : ''} ${pushed ? 'is-pushed' : ''}`.trim();

  const bg = document.createElement('div');
  bg.className = 'glass-card-bg';
  container.appendChild(bg);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'glass-card-content';
  if (content) {
    contentDiv.innerHTML = content;
  }
  container.appendChild(contentDiv);

  return container;
}

/**
 * Обновить состояние glass card (pushed/unpushed)
 */
export function setGlassCardState(card: HTMLElement, pushed: boolean): void {
  if (!card || !card.classList.contains('glass-card-container')) return;

  if (pushed) {
    card.classList.add('is-pushed');
  } else {
    card.classList.remove('is-pushed');
  }
}

export interface GlassPanelOptions {
  className?: string;
  content?: string;
  blur?: string;
  background?: string;
}

/**
 * Создать glass panel (для sidebar, activity bar и т.д.)
 */
export function createGlassPanel(options: GlassPanelOptions = {}): HTMLElement {
  const {
    className = '',
    content = '',
    blur = 'var(--glass-blur)',
    background = 'var(--glass-bg)'
  } = options;

  const panel = document.createElement('div');
  panel.className = `glass-panel ${className}`.trim();
  panel.style.cssText = `
    background: ${background};
    backdrop-filter: blur(${blur});
    -webkit-backdrop-filter: blur(${blur});
    border: 1px solid var(--border-color);
  `;

  if (content) {
    panel.innerHTML = content;
  }

  return panel;
}

// ==========================================================================
// 4. ОБРАБОТКА ИНТЕРАКТИВНЫХ СОСТОЯНИЙ
// ==========================================================================

export interface StateHandlers {
  onHover?: EventListener;
  onLeave?: EventListener;
  onActive?: EventListener;
  onRelease?: EventListener;
  onFocus?: EventListener;
  onBlur?: EventListener;
}

/**
 * Добавить обработчики состояний для элемента
 */
export function addStateHandlers(element: HTMLElement, handlers: StateHandlers = {}): void {
  const {
    onHover,
    onLeave,
    onActive,
    onRelease,
    onFocus,
    onBlur
  } = handlers;

  if (onHover) element.addEventListener('mouseenter', onHover);
  if (onLeave) element.addEventListener('mouseleave', onLeave);
  if (onActive) element.addEventListener('mousedown', onActive);
  if (onRelease) element.addEventListener('mouseup', onRelease);
  if (onFocus) element.addEventListener('focus', onFocus);
  if (onBlur) element.addEventListener('blur', onBlur);
}

/**
 * Создать ripple эффект при клике
 */
export function createRipple(element: HTMLElement, event: MouseEvent): void {
  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position: absolute;
    border-radius: 50%;
    background: var(--accent-glow, rgba(139, 92, 246, 0.3));
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
  `;

  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

  element.style.position = element.style.position || 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}

// Добавляем keyframes для ripple
if (typeof document !== 'undefined' && !document.getElementById('ripple-keyframes')) {
  const style = document.createElement('style');
  style.id = 'ripple-keyframes';
  style.textContent = `
    @keyframes ripple-animation {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// ==========================================================================
// 5. УТИЛИТЫ ДЛЯ КНОПОК
// ==========================================================================

export interface ButtonOptions {
  text?: string;
  icon?: string;
  variant?: 'primary' | 'outline' | 'secondary';
  className?: string;
  onClick?: EventListener | null;
  disabled?: boolean;
  size?: 'small' | 'normal' | 'large';
}

/**
 * Создать кнопку с новым дизайном
 */
export function createButton(options: ButtonOptions = {}): HTMLButtonElement {
  const {
    text = '',
    icon = '',
    variant = 'primary',
    className = '',
    onClick = null,
    disabled = false,
    size = 'normal'
  } = options;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${variant === 'outline' ? 'btn-outline' : ''} ${variant === 'secondary' ? 'btn-secondary' : ''} ${className}`.trim();
  btn.disabled = disabled;

  if (size === 'small') btn.classList.add('btn-small');
  if (size === 'large') btn.classList.add('btn-large');

  if (icon) {
    const iconEl = document.createElement('i');
    iconEl.className = icon;
    btn.appendChild(iconEl);
  }

  if (text) {
    const textNode = document.createTextNode(text);
    btn.appendChild(textNode);
  }

  if (onClick) btn.addEventListener('click', onClick);

  // Добавляем ripple эффект
  btn.addEventListener('click', (e: MouseEvent) => createRipple(btn, e));

  return btn;
}

// ==========================================================================
// 6. УТИЛИТЫ ДЛЯ КАРТОЧЕК
// ==========================================================================

export interface ProjectCardOptions {
  title?: string;
  subtitle?: string;
  icon?: string;
  stats?: Record<string, unknown>;
  onClick?: (() => void) | null;
  onEdit?: (() => void) | null;
  onDelete?: (() => void) | null;
  className?: string;
}

/**
 * Создать карточку проекта с новым дизайном
 */
export function createProjectCard(options: ProjectCardOptions = {}): HTMLElement {
  const {
    title = '',
    subtitle = '',
    icon = '📁',
    stats = {},
    onClick = null,
    onEdit = null,
    onDelete = null,
    className = ''
  } = options;

  const card = createGlassCard({
    className: `project-card interactive-el ${className}`,
    interactive: true
  });

  const content = card.querySelector('.glass-card-content') as HTMLElement;

  let statsHTML = '';
  if (Object.keys(stats).length > 0) {
    statsHTML = `<div class="project-stats">
      ${Object.entries(stats).map(([key, value]) => `<span>${key}: ${value}</span>`).join('')}
    </div>`;
  }

  if (content) {
    content.innerHTML = `
      <div class="project-icon">${icon}</div>
      <h3 class="project-title">${title}</h3>
      ${subtitle ? `<p class="project-subtitle">${subtitle}</p>` : ''}
      ${statsHTML}
      <div class="project-actions">
        <button class="btn btn-small btn-open" type="button">Открыть</button>
        <button class="btn btn-small btn-edit" type="button">✏️</button>
        <button class="btn btn-small btn-danger btn-delete" type="button">🗑️</button>
      </div>
    `;
  }

  if (onClick) {
    card.addEventListener('click', (e: Event) => {
      if (!(e.target as HTMLElement).closest('.project-actions')) {
        onClick();
      }
    });
  }

  const openBtn = card.querySelector('.btn-open');
  const editBtn = card.querySelector('.btn-edit');
  const deleteBtn = card.querySelector('.btn-delete');

  if (onEdit && editBtn) editBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); onEdit(); });
  if (onDelete && deleteBtn) deleteBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); onDelete(); });
  if (onClick && openBtn) openBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); onClick(); });

  return card;
}