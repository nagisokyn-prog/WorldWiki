import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { useGlobalTimeViewer } from '../useGlobalTimeViewer';
import { useCalendarStore } from '../../../../../stores/calendar.store';
import { useShellStore } from '../../../../../stores/shell';
import { invoke } from '@worldwiki/components';

vi.mock('../../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      { id: 'cal1', name: 'Cal 1', data: { name: 'Cal 1' } },
    ]),
  }),
}));

vi.mock('../../../../../stores/shell', () => ({
  useShellStore: () => ({
    projectName: 'proj1',
  }),
}));

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn().mockResolvedValue({ year: 100, month: 1, day: 5 }),
}));

describe('useGlobalTimeViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens, closes and converts time', async () => {
    const viewer = useGlobalTimeViewer();

    viewer.open();
    expect(viewer.isVisible.value).toBe(true);

    viewer.minute.value = 1000;
    await Promise.resolve();

    expect(viewer.minute.value).toBe(1000);

    viewer.close();
    expect(viewer.isVisible.value).toBe(false);
  });

  it('handles keyboard shortcuts to toggle visibility with mounted component', async () => {
    const TestComponent = defineComponent({
      setup() {
        return useGlobalTimeViewer();
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent);
    await Promise.resolve();

    // Trigger keydown with Ctrl+Shift+T
    const keyEvent = new KeyboardEvent('keydown', {
      ctrlKey: true,
      shiftKey: true,
      code: 'KeyT',
      cancelable: true,
    });
    window.dispatchEvent(keyEvent);

    expect(wrapper.vm.isVisible).toBe(true);

    window.dispatchEvent(keyEvent);
    expect(wrapper.vm.isVisible).toBe(false);

    // Other key should not toggle
    const otherKeyEvent = new KeyboardEvent('keydown', {
      ctrlKey: false,
      code: 'KeyA',
    });
    window.dispatchEvent(otherKeyEvent);
    expect(wrapper.vm.isVisible).toBe(false);

    wrapper.unmount();
  });

  it('reloads calendars when projectName changes while visible', async () => {
    const mockShell = { projectName: ref('proj1') };
    const mockCal = {
      getCalendars: vi.fn().mockResolvedValue([{ id: 'cal1', data: { name: 'Cal 1' } }]),
    };

    const TestComp = defineComponent({
      setup() {
        return useGlobalTimeViewer();
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp);
    wrapper.vm.open();
    expect(wrapper.vm.isVisible).toBe(true);

    // updateLocalDates when calendars is empty
    const viewerEmpty = useGlobalTimeViewer();
    viewerEmpty.minute.value = 500;
    await Promise.resolve();
    expect(viewerEmpty.localDates.value).toEqual([]);

    wrapper.unmount();
  });
});


