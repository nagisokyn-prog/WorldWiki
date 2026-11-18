import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { usePromiseResize } from './usePromiseResize';

describe('usePromiseResize', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 42;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('resets invalid localStorage height on mount, resizes with RAF, and cleans up on unmount', () => {
    localStorage.setItem('chapters-panel-promises-h', '20');
    let resize!: ReturnType<typeof usePromiseResize>;
    const Comp = defineComponent({
      setup() {
        resize = usePromiseResize();
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    expect(resize.promisesHeight.value).toBe(260);

    resize.startVerticalResize(new MouseEvent('mousedown', { clientY: 100 }));
    expect(resize.isResizing.value).toBe(true);

    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
    expect(resize.promisesHeight.value).toBe(360);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(resize.isResizing.value).toBe(false);
    expect(localStorage.getItem('chapters-panel-promises-h')).toBe('360');

    // Start resize and unmount mid-drag
    resize.startVerticalResize(new MouseEvent('mousedown', { clientY: 100 }));
    wrapper.unmount();
    expect(document.body.style.cursor).toBe('');
  });
});
