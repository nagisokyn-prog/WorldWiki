import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useCalendarResize } from '../useCalendarResize';

describe('useCalendarResize', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('initializes from localStorage, resizes with clamping, persists on mouseup, and cleans up on unmount', () => {
    localStorage.setItem('worldwiki-calendar-widget-height', '200');
    let res!: ReturnType<typeof useCalendarResize>;
    const Comp = defineComponent({
      setup() {
        res = useCalendarResize();
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    expect(res.calendarHeight.value).toBe(200);

    res.startResizeCalendar(new MouseEvent('mousedown', { clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 160 }));
    expect(res.calendarHeight.value).toBe(260);

    // Clamp max 500
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 900 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(res.calendarHeight.value).toBe(500);
    expect(localStorage.getItem('worldwiki-calendar-widget-height')).toBe('500');

    // Clamp min 70 and cleanup while dragging on unmount
    res.startResizeCalendar(new MouseEvent('mousedown', { clientY: 500 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 0 }));
    expect(res.calendarHeight.value).toBe(70);

    wrapper.unmount();
  });
});
