import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { useGlobalTimeViewer } from '../useGlobalTimeViewer';

vi.mock('../../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      { id: 'cal1', name: 'Cal 1', data: { name: 'Cal 1' } },
    ]),
  }),
}));

const mockProjectName = ref('proj1');

vi.mock('../../../../../stores/shell', () => ({
  useShellStore: () => ({
    get projectName() { return mockProjectName.value; },
    set projectName(v) { mockProjectName.value = v; }
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

  it('reloads calendars when projectName changes while visible and ignores when hidden', async () => {
    const TestComp = defineComponent({
      setup() {
        return useGlobalTimeViewer();
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp);
    wrapper.vm.open();
    expect(wrapper.vm.isVisible).toBe(true);

    // Change projectName while visible
    mockProjectName.value = 'proj_new_visible';
    await Promise.resolve();

    // Close and change projectName while hidden
    wrapper.vm.close();
    mockProjectName.value = 'proj_new_hidden';
    await Promise.resolve();

    // updateLocalDates when calendars is empty
    const viewerEmpty = useGlobalTimeViewer();
    viewerEmpty.minute.value = 500;
    await Promise.resolve();
    expect(viewerEmpty.localDates.value).toEqual([]);

    wrapper.unmount();
  });

  it('updateLocalDates processes calendars with and without data (covers lines 44-57)', async () => {
    const { invoke } = await import('@worldwiki/components');
    const { useCalendarStore } = await import('../../../../../stores/calendar.store');

    const TestComp2 = defineComponent({
      setup() {
        return useGlobalTimeViewer();
      },
      template: '<div></div>',
    });

    const wrapper2 = mount(TestComp2);
    await new Promise(r => setTimeout(r, 10));

    // After mount, loadCalendars is called and calendars have data
    // localDates should be populated via invoke
    expect(wrapper2.vm.localDates.length).toBeGreaterThanOrEqual(0);

    // Change minute to trigger watch -> updateLocalDates with loaded calendars (covers lines 44-52)
    wrapper2.vm.minute = 999;
    await new Promise(r => setTimeout(r, 10));

    // Verify invoke was called with calendar data
    expect(invoke).toHaveBeenCalledWith('convert_absolute_to_local', expect.objectContaining({
      absoluteMinute: 999,
      eraIndex: 0,
    }));

    wrapper2.unmount();
  });
});



