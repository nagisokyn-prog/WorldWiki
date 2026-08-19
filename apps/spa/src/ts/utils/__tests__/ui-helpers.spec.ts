// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setCSSVariable,
  getCSSVariable,
  setCSSVariables,
  animateCSSVariable,
  createGlassCard,
  setGlassCardState,
  createGlassPanel,
  createButton,
  createProjectCard,
  addStateHandlers,
  createRipple,
  toggleElement,
  animateRemoval,
  animateEntrance,
  initInteractiveElements,
} from '../ui-helpers';

describe('ui-helpers', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    delete (window as any).gsap;
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

    it('animateCSSVariable sets variable directly without GSAP', () => {
      const el = document.createElement('div');
      animateCSSVariable('--my-var', '20px', { element: el });
      expect(el.style.getPropertyValue('--my-var')).toBe('20px');
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

    it('creates outline and small button with disabled state', () => {
      const btn = createButton({
        text: 'Outline',
        variant: 'outline',
        size: 'small',
        disabled: true,
      });
      expect(btn.classList.contains('btn-outline')).toBe(true);
      expect(btn.classList.contains('btn-small')).toBe(true);
      expect(btn.disabled).toBe(true);
    });

    it('creates secondary button', () => {
      const btn = createButton({
        text: 'Secondary',
        variant: 'secondary',
      });
      expect(btn.classList.contains('btn-secondary')).toBe(true);
    });
  });

  describe('Project Card creation', () => {
    it('creates project card with stats and action callbacks', () => {
      const onClick = vi.fn();
      const onEdit = vi.fn();
      const onDelete = vi.fn();

      const card = createProjectCard({
        title: 'My Project',
        subtitle: 'Epic Novel',
        icon: '📖',
        stats: { Chapters: 10, Words: 25000 },
        onClick,
        onEdit,
        onDelete,
      });

      expect(card.querySelector('.project-title')?.textContent).toBe('My Project');
      expect(card.querySelector('.project-subtitle')?.textContent).toBe('Epic Novel');
      expect(card.querySelector('.project-stats')?.textContent).toContain('Chapters: 10');

      // Click open button
      const openBtn = card.querySelector('.btn-open') as HTMLButtonElement;
      openBtn.click();
      expect(onClick).toHaveBeenCalledTimes(1);

      // Click edit button
      const editBtn = card.querySelector('.btn-edit') as HTMLButtonElement;
      editBtn.click();
      expect(onEdit).toHaveBeenCalledTimes(1);

      // Click delete button
      const deleteBtn = card.querySelector('.btn-delete') as HTMLButtonElement;
      deleteBtn.click();
      expect(onDelete).toHaveBeenCalledTimes(1);

      // Direct card click
      card.click();
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Interactive states & Ripple', () => {
    it('adds state event handlers to element', () => {
      const el = document.createElement('button');
      const onHover = vi.fn();
      const onLeave = vi.fn();
      const onActive = vi.fn();
      const onRelease = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      addStateHandlers(el, { onHover, onLeave, onActive, onRelease, onFocus, onBlur });

      el.dispatchEvent(new MouseEvent('mouseenter'));
      expect(onHover).toHaveBeenCalled();

      el.dispatchEvent(new MouseEvent('mouseleave'));
      expect(onLeave).toHaveBeenCalled();

      el.dispatchEvent(new MouseEvent('mousedown'));
      expect(onActive).toHaveBeenCalled();

      el.dispatchEvent(new MouseEvent('mouseup'));
      expect(onRelease).toHaveBeenCalled();

      el.dispatchEvent(new FocusEvent('focus'));
      expect(onFocus).toHaveBeenCalled();

      el.dispatchEvent(new FocusEvent('blur'));
      expect(onBlur).toHaveBeenCalled();
    });

    it('creates ripple effect on click and cleans up with timer', () => {
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

  describe('Animations (without GSAP)', () => {
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

    it('animateEntrance warns and exits safely without GSAP', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      animateEntrance('.some-el');
      expect(warnSpy).toHaveBeenCalled();
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

      el.dispatchEvent(new MouseEvent('mousedown'));
      expect(el.style.transform).toContain('scale');

      el.dispatchEvent(new MouseEvent('mouseup'));
      expect(el.style.transform).toContain('scale');
    });
  });
});
