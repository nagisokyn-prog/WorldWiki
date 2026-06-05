/**
 * @file dom-utils.ts
 * @description Утилиты для работы с DOM
 * @note DOM-зависимый, не rust-ready
 */

// ==========================================================================
// 1. БЕЗОПАСНОЕ СОЗДАНИЕ ЭЛЕМЕНТОВ
// ==========================================================================

export interface CreateElementOptions {
  className?: string;
  id?: string;
  attributes?: Record<string, string>;
  styles?: Partial<CSSStyleDeclaration>;
  text?: string;
  html?: string;
  children?: (string | HTMLElement)[];
  events?: Record<string, EventListener>;
  dataset?: Record<string, string>;
}

/**
 * Создать DOM элемент с атрибутами и дочерними элементами
 */
export function createElement(tag: string, options: CreateElementOptions = {}): HTMLElement {
  const {
    className = '',
    id = '',
    attributes = {},
    styles = {},
    text = '',
    html = '',
    children = [],
    events = {},
    dataset = {}
  } = options;

  const element = document.createElement(tag);

  if (className) element.className = className;
  if (id) element.id = id;

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });

  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, unknown>)[key] = value;
    }
  });

  if (text) {
    element.textContent = text;
  }

  if (html && !text) {
    element.innerHTML = html;
  }

  children.forEach(child => {
    if (child) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    }
  });

  Object.entries(events).forEach(([event, handler]) => {
    if (typeof handler === 'function') {
      element.addEventListener(event, handler);
    }
  });

  Object.entries(dataset).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.dataset[key] = value;
    }
  });

  return element;
}

/**
 * Создать несколько элементов
 */
export function createElements(configs: Array<{ tag: string; options?: CreateElementOptions }>): HTMLElement[] {
  return configs.map(config => createElement(config.tag, config.options));
}

// ==========================================================================
// 2. БЕЗОПАСНАЯ ВСТАВКА HTML
// ==========================================================================

/**
 * Экранировать HTML символы
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Безопасно вставить текст как HTML
 */
export function setSafeText(element: HTMLElement | null, text: string): void {
  if (element && text) {
    element.textContent = text;
  }
}

/**
 * Создать элемент с безопасным текстом
 */
export function createSafeElement(tag: string, text: string, className: string = ''): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/**
 * Шаблонизатор с подстановкой безопасных значений
 */
export function safeTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? escapeHtml(String(value)) : '';
  });
}

// ==========================================================================
// 3. ОБРАБОТКА СОБЫТИЙ
// ==========================================================================

/**
 * Добавить обработчик события с debounce
 */
export function addDebouncedEventListener(
  element: HTMLElement,
  event: string,
  handler: EventListener,
  delay: number = 300
): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  const debouncedHandler = function(this: HTMLElement, e: Event) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => handler.call(this, e), delay);
  };

  element.addEventListener(event, debouncedHandler);

  return () => {
    element.removeEventListener(event, debouncedHandler);
    clearTimeout(timeoutId);
  };
}

/**
 * Добавить обработчик события с throttle
 */
export function addThrottledEventListener(
  element: HTMLElement,
  event: string,
  handler: EventListener,
  limit: number = 300
): () => void {
  let lastCall = 0;

  const throttledHandler = function(this: HTMLElement, e: Event) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      handler.call(this, e);
    }
  };

  element.addEventListener(event, throttledHandler);

  return () => {
    element.removeEventListener(event, throttledHandler);
  };
}

/**
 * Добавить обработчик с делегированием событий
 */
export function addDelegatedEventListener(
  parent: HTMLElement,
  selector: string,
  event: string,
  handler: (this: HTMLElement, e: Event) => void
): () => void {
  const delegatedHandler = (e: Event) => {
    const target = (e.target as HTMLElement).closest(selector) as HTMLElement | null;
    if (target && parent.contains(target)) {
      handler.call(target, e);
    }
  };

  parent.addEventListener(event, delegatedHandler);

  return () => {
    parent.removeEventListener(event, delegatedHandler);
  };
}

export interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Добавить обработчик для комбинации клавиш
 */
export function addKeyHandler(
  element: HTMLElement,
  key: string,
  handler: (e: KeyboardEvent) => void,
  modifiers: KeyModifiers = {}
): void {
  element.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== key.toLowerCase()) return;
    if (modifiers.ctrl && !e.ctrlKey && !e.metaKey) return;
    if (modifiers.alt && !e.altKey) return;
    if (modifiers.shift && !e.shiftKey) return;

    e.preventDefault();
    handler(e);
  });
}

// ==========================================================================
// 4. НАВИГАЦИЯ ПО DOM
// ==========================================================================

/**
 * Найти ближайший родительский элемент по селектору
 */
export function findClosest(element: HTMLElement | null, selector: string): HTMLElement | null {
  if (!element) return null;
  return element.closest(selector);
}

/**
 * Найти все элементы внутри контейнера
 */
export function findAll(container: HTMLElement | null, selector: string): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

/**
 * Найти первый элемент внутри контейнера
 */
export function findFirst(container: HTMLElement | null, selector: string): HTMLElement | null {
  if (!container) return null;
  return container.querySelector(selector);
}

/**
 * Проверить содержит ли элемент другой элемент
 */
export function contains(parent: HTMLElement | null, child: HTMLElement | null): boolean {
  if (!parent || !child) return false;
  return parent.contains(child);
}

// ==========================================================================
// 5. МАНИПУЛЯЦИЯ КЛАССАМИ
// ==========================================================================

/**
 * Добавить классы элементу
 */
export function addClasses(element: HTMLElement | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.add(...classes.filter(Boolean));
}

/**
 * Удалить классы у элемента
 */
export function removeClasses(element: HTMLElement | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.remove(...classes.filter(Boolean));
}

/**
 * Переключить класс у элемента
 */
export function toggleClass(element: HTMLElement | null, className: string, force?: boolean): void {
  if (!element) return;
  if (force !== undefined) {
    element.classList.toggle(className, force);
  } else {
    element.classList.toggle(className);
  }
}

/**
 * Проверить имеет ли элемент класс
 */
export function hasClass(element: HTMLElement | null, className: string): boolean {
  if (!element) return false;
  return element.classList.contains(className);
}

// ==========================================================================
// 6. РАБОТА С АТРИБУТАМИ
// ==========================================================================

/**
 * Установить data атрибут
 */
export function setDataAttribute(element: HTMLElement | null, key: string, value: string): void {
  if (!element) return;
  element.dataset[key] = value;
}

/**
 * Получить data атрибут
 */
export function getDataAttribute(element: HTMLElement | null, key: string): string | undefined {
  if (!element) return undefined;
  return element.dataset[key];
}

// ==========================================================================
// 7. УТИЛИТЫ ДЛЯ ФОРМ
// ==========================================================================

/**
 * Получить значение из формы
 */
export function getFormValue(form: HTMLFormElement | null, name: string): string | undefined {
  if (!form) return undefined;
  const input = form.querySelector(`[name="${name}"]`);
  return input ? (input as HTMLInputElement).value : undefined;
}

/**
 * Установить значение в форму
 */
export function setFormValue(form: HTMLFormElement | null, name: string, value: string): void {
  if (!form) return;
  const input = form.querySelector(`[name="${name}"]`);
  if (input) {
    (input as HTMLInputElement).value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Собрать все данные формы
 */
export function collectFormData(form: HTMLFormElement | null): Record<string, unknown> {
  if (!form) return {};

  const data: Record<string, unknown> = {};
  const inputs = form.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    const el = input as HTMLInputElement;
    if (el.name) {
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) {
          data[el.name] = el.value;
        }
      } else {
        data[el.name] = el.value;
      }
    }
  });

  return data;
}

// ==========================================================================
// 8. УТИЛИТЫ ДЛЯ МОДАЛЬНЫХ ОКОН
// ==========================================================================

export interface ModalOptions {
  onClose?: (() => void) | null;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

interface ModalElement extends HTMLElement {
  _backdropHandler?: EventListener;
  _escapeHandler?: EventListener;
}

/**
 * Показать модальное окно
 */
export function showModal(modal: ModalElement | null, options: ModalOptions = {}): void {
  if (!modal) return;

  const {
    onClose = null,
    closeOnBackdrop = true,
    closeOnEscape = true
  } = options;

  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');

  if (closeOnBackdrop) {
    const backdropHandler = (e: Event) => {
      if (e.target === modal) {
        hideModal(modal);
        if (onClose) onClose();
      }
    };
    modal.addEventListener('click', backdropHandler);
    modal._backdropHandler = backdropHandler;
  }

  if (closeOnEscape) {
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideModal(modal);
        if (onClose) onClose();
      }
    };
    document.addEventListener('keydown', escapeHandler as EventListener);
    modal._escapeHandler = escapeHandler as unknown as EventListener;
  }

  const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) {
    setTimeout(() => (focusable as HTMLElement).focus(), 100);
  }
}

/**
 * Скрыть модальное окно
 */
export function hideModal(modal: ModalElement | null): void {
  if (!modal) return;

  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');

  if (modal._backdropHandler) {
    modal.removeEventListener('click', modal._backdropHandler);
    delete modal._backdropHandler;
  }
  if (modal._escapeHandler) {
    document.removeEventListener('keydown', modal._escapeHandler);
    delete modal._escapeHandler;
  }
}

// ==========================================================================
// 9. УТИЛИТЫ ДЛЯ СКРОЛЛА
// ==========================================================================

export interface ScrollOptions {
  offset?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}

/**
 * Прокрутить к элементу
 */
export function scrollToElement(element: HTMLElement | null, options: ScrollOptions = {}): void {
  if (!element) return;

  const {
    offset = 0,
    behavior = 'smooth',
    block = 'start'
  } = options;

  element.scrollIntoView({
    behavior,
    block
  });

  if (offset) {
    window.scrollBy(0, -offset);
  }
}

/**
 * Проверить виден ли элемент в viewport
 */
export function isElementVisible(element: HTMLElement | null, threshold: number = 0): boolean {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const viewHeight = window.innerHeight || document.documentElement.clientHeight;

  return rect.bottom > threshold && rect.top < viewHeight - threshold;
}