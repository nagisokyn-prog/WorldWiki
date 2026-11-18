import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope } from 'vue';
import {
  initInteractiveElements,
  useInteractiveElements,
  animateEntrance,
  animateRemoval,
  toggleElement,
} from '../ui.animations';

describe('ui.animations', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as any).gsap;
  });

  afterEach(() => {
    delete (globalThis as any).gsap;
  });

  it('handles CSS fallback when gsap is undefined', () => {
    const el = document.createElement('div');
    el.className = 'interactive-el';
    document.body.appendChild(el);

    const scope = effectScope();
    let cleanup!: () => void;
    scope.run(() => {
      cleanup = useInteractiveElements('.interactive-el');
    });

    el.dispatchEvent(new MouseEvent('mouseenter'));
    expect(el.style.transform).toContain('1.05');
    el.dispatchEvent(new MouseEvent('mousedown'));
    expect(el.style.transform).toContain('0.98');
    el.dispatchEvent(new MouseEvent('mouseup'));
    expect(el.style.transform).toContain('1.05');
    el.dispatchEvent(new MouseEvent('mouseleave'));
    expect(el.style.transform).toBe('scale(1)');

    scope.stop();
    cleanup();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    animateEntrance([el]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    toggleElement(el, false);
    expect(el.style.display).toBe('none');
    toggleElement(el, true);
    expect(el.style.display).toBe('');

    const cb = vi.fn();
    animateRemoval(el, cb);
    expect(document.body.contains(el)).toBe(false);
    expect(cb).toHaveBeenCalled();
  });

  it('delegates to gsap when gsap global is present', () => {
    const toMock = vi.fn((_target, vars) => {
      vars?.onComplete?.();
    });
    const fromToMock = vi.fn();
    (globalThis as any).gsap = { to: toMock, fromTo: fromToMock };

    const el = document.createElement('div');
    document.body.appendChild(el);

    const cleanup = initInteractiveElements(el, { pullScale: 1.1, pushScale: 0.9 });
    el.dispatchEvent(new MouseEvent('mouseenter'));
    el.dispatchEvent(new MouseEvent('mousedown'));
    el.dispatchEvent(new MouseEvent('mouseup'));
    el.dispatchEvent(new MouseEvent('mouseleave'));
    expect(toMock).toHaveBeenCalledTimes(4);
    cleanup();

    animateEntrance('div');
    expect(fromToMock).toHaveBeenCalled();

    toggleElement(el, true);
    expect(fromToMock).toHaveBeenCalledTimes(2);
    toggleElement(el, false);
    expect(el.style.display).toBe('none');

    const cb = vi.fn();
    animateRemoval(el, cb);
    expect(cb).toHaveBeenCalled();
  });
});
