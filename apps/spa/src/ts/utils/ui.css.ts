declare const gsap: {
  to: (target: unknown, vars: Record<string, unknown>) => unknown;
} | undefined;

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
