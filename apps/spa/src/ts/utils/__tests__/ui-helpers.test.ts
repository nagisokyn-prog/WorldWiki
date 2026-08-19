// tests for ui-helpers core utilities
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initInteractiveElements,
  animateEntrance,
  animateRemoval,
  toggleElement,
  setCSSVariable,
  getCSSVariable,
  setCSSVariables,
  animateCSSVariable,
  createGlassCard,
  setGlassCardState,
  createGlassPanel,
  addStateHandlers,
  createRipple,
} from '../ui-helpers';

// Ensure gsap is undefined to test fallback behavior
vi.stubGlobal('gsap', undefined);

describe('ui-helpers fallback behavior without GSAP', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('initInteractiveElements applies CSS transition fallback', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    initInteractiveElements(el);
    el.dispatchEvent(new Event('mouseenter'));
    expect(el.style.transform).toBe('scale(1.05)');
  });

  it('animateEntrance returns silently when GSAP missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    animateEntrance('.nonexistent');
    expect(warnSpy).toHaveBeenCalledWith('GSAP not loaded, skipping animation');
    warnSpy.mockRestore();
  });

  it('animateRemoval removes element and calls callback', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const cb = vi.fn();
    animateRemoval(el, cb);
    expect(document.body.contains(el)).toBe(false);
    expect(cb).toHaveBeenCalled();
  });

  it('toggleElement shows/hides element without GSAP', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    toggleElement(el, false);
    expect(el.style.display).toBe('none');
    toggleElement(el, true);
    expect(el.style.display).toBe('');
  });

  it('CSS variable helpers work correctly', () => {
    setCSSVariable('--test-var', '10px');
    expect(getCSSVariable('--test-var')).toBe('10px');
    setCSSVariables({ '--a': '1', '--b': '2' });
    expect(getCSSVariable('--a')).toBe('1');
    expect(getCSSVariable('--b')).toBe('2');
  });

  it('animateCSSVariable falls back to setCSSVariable when GSAP missing', () => {
    const setPropSpy = vi.spyOn(document.documentElement.style, 'setProperty');
    animateCSSVariable('--anim-var', '100px');
    expect(setPropSpy).toHaveBeenCalledWith('--anim-var', '100px');
    setPropSpy.mockRestore();
  });

  it('createGlassCard returns container with proper classes and content', () => {
    const card = createGlassCard({ content: '<p>Hello</p>', pushed: true });
    expect(card.classList.contains('is-pushed')).toBe(true);
    const contentDiv = card.querySelector('.glass-card-content');
    expect(contentDiv?.innerHTML).toBe('<p>Hello</p>');
  });

  it('setGlassCardState toggles is-pushed class', () => {
    const card = createGlassCard();
    setGlassCardState(card, true);
    expect(card.classList.contains('is-pushed')).toBe(true);
    setGlassCardState(card, false);
    expect(card.classList.contains('is-pushed')).toBe(false);
  });

  it('createGlassPanel creates element with styles and optional content', () => {
    const panel = createGlassPanel({ content: '<span>X</span>', blur: '5px' });
    expect(panel.innerHTML).toBe('<span>X</span>');
    expect(panel.style.backdropFilter).toContain('5px');
  });

  it('addStateHandlers attaches event listeners', () => {
    const el = document.createElement('div');
    const onHover = vi.fn();
    addStateHandlers(el, { onHover });
    el.dispatchEvent(new Event('mouseenter'));
    expect(onHover).toHaveBeenCalled();
  });

  it('createRipple inserts a span element into target', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ev = new MouseEvent('click', { clientX: 0, clientY: 0 });
    createRipple(el, ev);
    expect(el.querySelector('span')).not.toBeNull();
  });
});
