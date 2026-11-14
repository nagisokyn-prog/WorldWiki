import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { mount } from '@vue/test-utils';
import { useFigureNodeView } from './useFigureNodeView';
import type { FigureNodeViewProps } from './FigureNodeView.model';

describe('useFigureNodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountComposable(attrsOverrides: Record<string, unknown> = {}) {
    const updateAttributes = vi.fn();
    const props = reactive({
      node: {
        attrs: {
          src: 'img/map.png',
          caption: 'Карта мира',
          computedNumber: '1.2',
          alignment: 'left',
          width: 400,
          ...attrsOverrides
        }
      },
      updateAttributes
    }) as unknown as FigureNodeViewProps;

    let api!: ReturnType<typeof useFigureNodeView>;

    const Comp = defineComponent({
      setup() {
        api = useFigureNodeView(props);
        return () => h('div');
      }
    });

    const wrapper = mount(Comp);
    return { wrapper, api, props, updateAttributes };
  }

  it('computes figure properties and prefixLabel with fallbacks', () => {
    const { wrapper, api, props } = mountComposable();

    expect(api.src.value).toBe('img/map.png');
    expect(api.caption.value).toBe('Карта мира');
    expect(api.computedNumber.value).toBe('1.2');
    expect(api.alignment.value).toBe('left');
    expect(api.width.value).toBe('400px');
    expect(api.prefixLabel.value).toBe('Рисунок 1.2 —');

    props.node.attrs.width = '60%';
    expect(api.width.value).toBe('60%');

    props.node.attrs.width = undefined;
    props.node.attrs.computedNumber = '';
    props.node.attrs.alignment = undefined;
    expect(api.width.value).toBe('100%');
    expect(api.prefixLabel.value).toBe('Рисунок');
    expect(api.alignment.value).toBe('center');

    wrapper.unmount();
  });

  it('updates caption via updateAttributes', () => {
    const { wrapper, api, updateAttributes } = mountComposable();

    api.updateCaption('Новая подпись');
    expect(updateAttributes).toHaveBeenCalledWith({ caption: 'Новая подпись' });

    wrapper.unmount();
  });

  it('resizes figure on mousemove within [150, 1200] bounds and cleans up on mouseup', () => {
    const { wrapper, api, updateAttributes } = mountComposable({ width: 500 });

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    api.startResize({
      clientX: 300,
      preventDefault,
      stopPropagation
    } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 450 }));
    expect(updateAttributes).toHaveBeenLastCalledWith({ width: 650 });

    // Clamps to min 150
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: -500 }));
    expect(updateAttributes).toHaveBeenLastCalledWith({ width: 150 });

    // Clamps to max 1200
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2000 }));
    expect(updateAttributes).toHaveBeenLastCalledWith({ width: 1200 });

    // Mouseup stops resizing
    window.dispatchEvent(new MouseEvent('mouseup'));
    updateAttributes.mockClear();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    expect(updateAttributes).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('cleans up active resize listeners on unmount', () => {
    const { wrapper, api, updateAttributes } = mountComposable({ width: 'invalid' });

    api.startResize({
      clientX: 100,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as MouseEvent);

    // Invalid string width falls back to 500
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    expect(updateAttributes).toHaveBeenLastCalledWith({ width: 550 });

    wrapper.unmount();
    updateAttributes.mockClear();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }));
    expect(updateAttributes).not.toHaveBeenCalled();
  });
});

