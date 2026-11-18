import { describe, it, expect, vi } from 'vitest';
import {
  createGlassPanel,
  addStateHandlers,
  createRipple,
  createButton,
  createProjectCard,
} from './ui.dom';

describe('ui.dom', () => {
  it('createGlassPanel creates panel with and without content', () => {
    const empty = createGlassPanel();
    expect(empty.className).toBe('glass-panel');
    const filled = createGlassPanel({ className: 'extra', content: '<span>Hi</span>' });
    expect(filled.innerHTML).toContain('Hi');
  });

  it('addStateHandlers supports function and EventListenerObject handlers and cleans up', () => {
    const el = document.createElement('div');
    const fn = vi.fn();
    const objListener: EventListenerObject = { handleEvent: vi.fn() };

    const cleanup = addStateHandlers(el, {
      onHover: fn,
      onLeave: objListener,
      onActive: fn,
      onRelease: objListener,
      onFocus: fn,
      onBlur: objListener,
    });

    el.onmouseenter?.(new MouseEvent('mouseenter'));
    el.onmouseleave?.(new MouseEvent('mouseleave'));
    el.onmousedown?.(new MouseEvent('mousedown'));
    el.onmouseup?.(new MouseEvent('mouseup'));
    el.onfocus?.(new FocusEvent('focus'));
    el.onblur?.(new FocusEvent('blur'));

    expect(fn).toHaveBeenCalledTimes(3);
    expect(objListener.handleEvent).toHaveBeenCalledTimes(3);

    cleanup();
    expect(el.onmouseenter).toBeNull();
    expect(el.onblur).toBeNull();

    const noopCleanup = addStateHandlers(el);
    noopCleanup();
  });

  it('createRipple and createButton cover text, icon, function/object onClick, and default ripple', () => {
    const fn = vi.fn();
    const btnFn = createButton({ text: 'Click', icon: 'fas fa-plus', onClick: fn });
    btnFn.click();
    expect(fn).toHaveBeenCalled();

    const objListener: EventListenerObject = { handleEvent: vi.fn() };
    const btnObj = createButton({ onClick: objListener });
    btnObj.click();
    expect(objListener.handleEvent).toHaveBeenCalled();

    const btnDefault = createButton({});
    btnDefault.click();
    expect(document.getElementById('ripple-keyframes')).not.toBeNull();
    createRipple(btnDefault, new MouseEvent('click'));
  });

  it('createProjectCard renders stats, subtitle, and handles card/open/edit/delete clicks', () => {
    const onClick = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const card = createProjectCard({
      title: 'Мир',
      subtitle: 'Описание',
      stats: { Главы: 5 },
      onClick,
      onEdit,
      onDelete,
    });

    expect(card.querySelector('.project-subtitle')?.textContent).toBe('Описание');
    expect(card.querySelector('.project-stats')?.textContent).toContain('Главы: 5');

    (card.querySelector('.project-title') as HTMLElement).click();
    (card.querySelector('.btn-open') as HTMLButtonElement).click();
    (card.querySelector('.btn-edit') as HTMLButtonElement).click();
    (card.querySelector('.btn-delete') as HTMLButtonElement).click();

    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
