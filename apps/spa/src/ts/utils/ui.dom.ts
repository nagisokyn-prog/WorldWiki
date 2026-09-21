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
export function addStateHandlers(element: HTMLElement, handlers: StateHandlers = {}): () => void {
  const {
    onHover,
    onLeave,
    onActive,
    onRelease,
    onFocus,
    onBlur
  } = handlers;

  const toHandler = (h?: EventListener) => (h ? ((e: Event) => {
    if (typeof h === 'function') {
      (h as (evt: Event) => void)(e);
    } else if (h && typeof (h as EventListenerObject).handleEvent === 'function') {
      (h as EventListenerObject).handleEvent(e);
    }
  }) : null);

  if (onHover) element.onmouseenter = toHandler(onHover);
  if (onLeave) element.onmouseleave = toHandler(onLeave);
  if (onActive) element.onmousedown = toHandler(onActive);
  if (onRelease) element.onmouseup = toHandler(onRelease);
  if (onFocus) element.onfocus = toHandler(onFocus);
  if (onBlur) element.onblur = toHandler(onBlur);

  return () => {
    if (onHover) element.onmouseenter = null;
    if (onLeave) element.onmouseleave = null;
    if (onActive) element.onmousedown = null;
    if (onRelease) element.onmouseup = null;
    if (onFocus) element.onfocus = null;
    if (onBlur) element.onblur = null;
  };
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

  if (onClick) {
    btn.onclick = (e) => {
      createRipple(btn, e);
      if (typeof onClick === 'function') {
        onClick(e);
      } else if (onClick && typeof (onClick as EventListenerObject).handleEvent === 'function') {
        (onClick as EventListenerObject).handleEvent(e);
      }
    };
  } else {
    btn.onclick = (e) => createRipple(btn, e);
  }

  return btn;
}

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
    card.onclick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.project-actions')) {
        onClick();
      }
    };
  }

  const openBtn = card.querySelector('.btn-open') as HTMLButtonElement | null;
  const editBtn = card.querySelector('.btn-edit') as HTMLButtonElement | null;
  const deleteBtn = card.querySelector('.btn-delete') as HTMLButtonElement | null;

  if (onEdit && editBtn) editBtn.onclick = (e: MouseEvent) => { e.stopPropagation(); onEdit(); };
  if (onDelete && deleteBtn) deleteBtn.onclick = (e: MouseEvent) => { e.stopPropagation(); onDelete(); };
  if (onClick && openBtn) openBtn.onclick = (e: MouseEvent) => { e.stopPropagation(); onClick(); };

  return card;
}
