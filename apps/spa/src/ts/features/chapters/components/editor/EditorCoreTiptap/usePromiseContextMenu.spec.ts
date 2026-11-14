import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';
import { mount } from '@vue/test-utils';
import {
  usePromiseContextMenu,
  promiseTypes,
  type PromiseContextMenuProps,
  type PromiseContextMenuEmits
} from './usePromiseContextMenu';
import type { PlotPromise } from '@/types/generated/PlotPromise';

describe('usePromiseContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountComposable(initialProps: PromiseContextMenuProps) {
    const emitted: Array<{ event: string; args: unknown[] }> = [];
    const emit = ((event: string, ...args: unknown[]) => {
      emitted.push({ event, args });
    }) as unknown as PromiseContextMenuEmits;

    const state = reactive({ ...initialProps }) as PromiseContextMenuProps;
    let api!: ReturnType<typeof usePromiseContextMenu>;

    const Comp = defineComponent({
      setup() {
        api = usePromiseContextMenu(state, emit);
        return () => h('div');
      }
    });

    const wrapper = mount(Comp, {
      attachTo: document.body
    });

    return { wrapper, api, emitted, state };
  }

  it('filters activeExistingPromises and resolves kind icons and labels', () => {
    const promises = [
      { id: 'p1', title: 'Ружьё', kind: 'gun', status: 'open', quote: 'На стене' },
      { id: 'p2', title: 'Закрыто', kind: 'mystery', status: 'resolved', quote: '' },
      { id: 'p3', title: 'Неизвестно', kind: 'custom_kind', status: 'open', quote: '' }
    ] as unknown as PlotPromise[];

    const { wrapper, api } = mountComposable({
      isOpen: false,
      position: { x: 100, y: 100 },
      existingPromises: promises
    });

    expect(api.activeExistingPromises.value).toHaveLength(2);
    expect(api.activeExistingPromises.value[0]).toMatchObject({
      id: 'p1',
      kindIcon: '🔫',
      kindLabel: 'Чеховское ружьё',
      quote: 'На стене'
    });
    expect(api.activeExistingPromises.value[1]).toMatchObject({
      id: 'p3',
      kindIcon: '📌',
      kindLabel: 'Обещание',
      quote: 'Неизвестно'
    });

    expect(api.getKindIcon('mystery')).toBe('🗝️');
    expect(api.getKindLabel('foreshadowing')).toBe('Предзнаменование');
    expect(api.getKindIcon('unknown')).toBe('📌');
    expect(api.getKindLabel('unknown')).toBe('Обещание');

    wrapper.unmount();
  });

  it('emits select, link-milestone, link-subscene, and close', () => {
    const { wrapper, api, emitted } = mountComposable({
      isOpen: true,
      position: { x: 50, y: 50 },
      existingPromises: []
    });

    const p = { id: 'p1', title: 'Test' } as PlotPromise;
    api.selectItem(promiseTypes[0]);
    api.selectMilestone(p, 'progression');
    api.selectSubScene(p);

    expect(emitted).toEqual([
      { event: 'select', args: [promiseTypes[0]] },
      { event: 'close', args: [] },
      { event: 'link-milestone', args: [{ promise: p, stage: 'progression' }] },
      { event: 'close', args: [] },
      { event: 'link-subscene', args: [{ promise: p }] },
      { event: 'close', args: [] }
    ]);

    wrapper.unmount();
  });

  it('handles keyboard navigation, Enter, Escape, and click outside when open', async () => {
    const { wrapper, api, emitted, state } = mountComposable({
      isOpen: false,
      position: { x: 50, y: 50 },
      existingPromises: []
    });

    // When closed, keydown is ignored
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitted).toHaveLength(0);

    state.isOpen = true;
    await nextTick();

    expect(api.selectedIndex.value).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(api.selectedIndex.value).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(api.selectedIndex.value).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(api.selectedIndex.value).toBe(promiseTypes.length - 1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitted[0]).toEqual({ event: 'select', args: [promiseTypes[promiseTypes.length - 1]] });
    expect(emitted[1]).toEqual({ event: 'close', args: [] });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitted[2]).toEqual({ event: 'close', args: [] });

    // Click inside menuRef does not emit close
    const insideEl = wrapper.element as HTMLElement;
    api.menuRef.value = insideEl;
    insideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(emitted).toHaveLength(3);

    // Click outside menuRef emits close
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(emitted[3]).toEqual({ event: 'close', args: [] });
    outsideEl.remove();

    wrapper.unmount();
  });

  it('clamps adjustedPos inside viewport when opened', async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

    const { wrapper, api, state } = mountComposable({
      isOpen: false,
      position: { x: 480, y: 380 },
      existingPromises: []
    });

    const el = wrapper.element as HTMLElement;
    api.menuRef.value = el;
    el.getBoundingClientRect = vi.fn(() => ({
      width: 240,
      height: 200,
      top: 0,
      left: 0,
      right: 240,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }));

    state.isOpen = true;
    await nextTick();
    await nextTick();

    expect(api.adjustedPos.value.x).toBe(244);
    expect(api.adjustedPos.value.y).toBe(184);

    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
    wrapper.unmount();
  });
});
