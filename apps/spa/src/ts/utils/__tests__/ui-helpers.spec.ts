// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setCSSVariable,
  getCSSVariable,
  setCSSVariables,
  createGlassCard,
  setGlassCardState,
  createGlassPanel,
  createButton,
  addStateHandlers,
  createRipple,
  toggleElement,
  animateRemoval,
  initInteractiveElements,
} from '../ui-helpers';

describe('ui-helpers', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('CSS Variables', () => {
    it('sets and gets CSS variable on element', () => {
      const el = document.createElement('div');
      setCSSVariable('--test-color', '#ff0000', el);
      expect(el.style.getPropertyValue('--test-color')).toBe('#ff0000');
      expect(getCSSVariable('--test-color', el)).toBe('#ff0000');
    });

    it('sets multiple CSS variables', () => {
      const el = document.createElement('div');
      setCSSVariables({
        '--color-primary': '#00ff00',
        '--spacing-sm': '8px',
      }, el);
      expect(el.style.getPropertyValue('--color-primary')).toBe('#00ff00');
      expect(el.style.getPropertyValue('--spacing-sm')).toBe('8px');
    });
  });

  describe('Glassmorphism components', () => {
    it('creates glass card with default and custom options', () => {
      const card = createGlassCard({
        className: 'custom-card',
        content: '<span>Hello</span>',
        interactive: true,
        pushed: true,
      });

      expect(card.classList.contains('glass-card-container')).toBe(true);
      expect(card.classList.contains('custom-card')).toBe(true);
      expect(card.classList.contains('interactive-el')).toBe(true);
      expect(card.classList.contains('is-pushed')).toBe(true);
      expect(card.querySelector('.glass-card-bg')).not.toBeNull();
      expect(card.querySelector('.glass-card-content')?.innerHTML).toBe('<span>Hello</span>');
    });

    it('updates glass card pushed state correctly', () => {
      const card = createGlassCard({ interactive: false });
      expect(card.classList.contains('is-pushed')).toBe(false);

      setGlassCardState(card, true);
      expect(card.classList.contains('is-pushed')).toBe(true);

      setGlassCardState(card, false);
      expect(card.classList.contains('is-pushed')).toBe(false);

      // Non-glass card should be ignored safely
      const div = document.createElement('div');
      expect(() => setGlassCardState(div, true)).not.toThrow();
    });

    it('creates glass panel with custom styles', () => {
      const panel = createGlassPanel({
        className: 'my-panel',
        content: '<p>Panel content</p>',
        blur: '10px',
        background: 'rgba(0,0,0,0.5)',
      });

      expect(panel.classList.contains('glass-panel')).toBe(true);
      expect(panel.classList.contains('my-panel')).toBe(true);
      expect(panel.innerHTML).toBe('<p>Panel content</p>');
    });
  });

  describe('Button creation', () => {
    it('creates button with text, icon, and click handler', () => {
      const handleClick = vi.fn();
      const btn = createButton({
        text: 'Save',
        icon: 'fas fa-save',
        variant: 'primary',
        size: 'large',
        onClick: handleClick,
      });

      expect(btn.tagName).toBe('BUTTON');
      expect(btn.classList.contains('btn')).toBe(true);
      expect(btn.classList.contains('btn-large')).toBe(true);
      expect(btn.textContent).toContain('Save');

      btn.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('creates disabled button', () => {
      const btn = createButton({
        text: 'Disabled',
        disabled: true,
      });
      expect(btn.disabled).toBe(true);
    });
  });

  describe('Interactive states & Ripple', () => {
    it('adds state event handlers to element', () => {
      const el = document.createElement('button');
      const onHover = vi.fn();
      const onLeave = vi.fn();
      const onActive = vi.fn();

      addStateHandlers(el, { onHover, onLeave, onActive });

      el.dispatchEvent(new MouseEvent('mouseenter'));
      expect(onHover).toHaveBeenCalled();

      el.dispatchEvent(new MouseEvent('mouseleave'));
      expect(onLeave).toHaveBeenCalled();

      el.dispatchEvent(new MouseEvent('mousedown'));
      expect(onActive).toHaveBeenCalled();
    });

    it('creates ripple effect on click', () => {
      vi.useFakeTimers();
      const el = document.createElement('div');
      container.appendChild(el);

      const evt = new MouseEvent('click', { clientX: 50, clientY: 50 });
      createRipple(el, evt);

      const ripple = el.querySelector('span');
      expect(ripple).not.toBeNull();

      vi.advanceTimersByTime(650);
      expect(el.querySelector('span')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('Element animation fallbacks (when GSAP is undefined)', () => {
    it('toggles element display without GSAP', () => {
      const el = document.createElement('div');
      toggleElement(el, false);
      expect(el.style.display).toBe('none');

      toggleElement(el, true);
      expect(el.style.display).toBe('');
    });

    it('removes element and triggers callback without GSAP', () => {
      const el = document.createElement('div');
      container.appendChild(el);
      const cb = vi.fn();

      animateRemoval(el, cb);

      expect(container.contains(el)).toBe(false);
      expect(cb).toHaveBeenCalled();
    });

    it('initializes interactive elements with CSS transition fallback', () => {
      const el = document.createElement('div');
      el.className = 'interactive-el';
      container.appendChild(el);

      initInteractiveElements('.interactive-el', { duration: 0.2 });

      expect(el.style.transition).toContain('transform 0.2s ease');

      el.dispatchEvent(new MouseEvent('mouseenter'));
      expect(el.style.transform).toContain('scale');

      el.dispatchEvent(new MouseEvent('mouseleave'));
      expect(el.style.transform).toBe('scale(1)');
    });
  });
});
