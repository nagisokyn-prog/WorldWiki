import { onScopeDispose } from 'vue';

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
    ? (Array.from(document.querySelectorAll(selector)) as HTMLElement[])
    : [selector];

  const cleanups: Array<() => void> = [];

  elements.forEach((el) => {
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
    gsap?.fromTo(
      element,
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
