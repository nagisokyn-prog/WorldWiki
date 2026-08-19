// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { vGlass, setupGlass } from '../v-glass';

describe('vGlass directive and setupGlass', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('registers directive via setupGlass', () => {
    const mockApp = { directive: vi.fn() };
    setupGlass(mockApp);
    expect(mockApp.directive).toHaveBeenCalledWith('glass', vGlass);
  });

  describe('interactive modifier', () => {
    it('attaches mouseenter/leave/down/up listeners with gsap fallback', () => {
      (window as any).gsap = { to: vi.fn() };

      vGlass.mounted!(el, { modifiers: { interactive: true } } as any, null as any, null as any);

      el.dispatchEvent(new MouseEvent('mouseenter'));
      expect((window as any).gsap.to).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 1.05 }));

      el.dispatchEvent(new MouseEvent('mouseleave'));
      expect((window as any).gsap.to).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 1 }));

      el.dispatchEvent(new MouseEvent('mousedown'));
      expect((window as any).gsap.to).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 0.98 }));

      el.dispatchEvent(new MouseEvent('mouseup'));
      expect((window as any).gsap.to).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 1.05 }));
    });
  });

  describe('ripple modifier', () => {
    it('creates ripple element on mousedown and cleans it up', () => {
      vi.useFakeTimers();
      vGlass.mounted!(el, { modifiers: { ripple: true } } as any, null as any, null as any);

      el.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 20 }));

      const ripple = el.querySelector('.ripple');
      expect(ripple).not.toBeNull();

      vi.advanceTimersByTime(650);
      expect(el.querySelector('.ripple')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('pushpull modifier', () => {
    it('adds and removes is-pulled and is-pushed classes on hover/click', () => {
      vGlass.mounted!(el, { modifiers: { pushpull: true } } as any, null as any, null as any);

      el.dispatchEvent(new MouseEvent('mouseenter'));
      expect(el.classList.contains('is-pulled')).toBe(true);

      el.dispatchEvent(new MouseEvent('mouseleave'));
      expect(el.classList.contains('is-pulled')).toBe(false);

      el.dispatchEvent(new MouseEvent('mousedown'));
      expect(el.classList.contains('is-pushed')).toBe(true);

      el.dispatchEvent(new MouseEvent('mouseup'));
      expect(el.classList.contains('is-pushed')).toBe(false);
    });
  });

  describe('breathe modifier', () => {
    it('inserts input-breathe-bg if input child exists', () => {
      const input = document.createElement('input');
      el.appendChild(input);

      vGlass.mounted!(el, { modifiers: { breathe: true } } as any, null as any, null as any);

      const bg = el.querySelector('.input-breathe-bg');
      expect(bg).not.toBeNull();
    });
  });
});
