import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useGlobalCalendarWidget } from '../useGlobalCalendarWidget';
import { useCalendarStore } from '@/stores/calendar.store';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal_master',
        is_master: true,
        data: {
          название: 'Мастер Календарь',
          месяцы: [{ название: 'Январь', дней: 30 }],
          эпохи: [{ год_начала: 1, год_конца: 1000 }],
        },
      },
      {
        id: 'cal_local',
        is_master: false,
        data: {
          название: 'Местный Календарь',
          месяцы: [{ название: 'М1', дней: 30 }],
          эпохи: [{ год_начала: 1, год_конца: 1000 }],
        },
      },
    ]),
  }),
}));

describe('useGlobalCalendarWidget', () => {
  let props: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    props = { project: 'my-proj' };
  });

  it('runs onMounted and loads calendars automatically when mounted', async () => {
    let widgetInstance: any;
    const Comp = defineComponent({
      setup() {
        widgetInstance = useGlobalCalendarWidget(props);
        return () => null;
      },
    });

    const wrapper = mount(Comp);
    await new Promise((r) => setTimeout(r, 0));

    expect(widgetInstance.masterCalendar.value).toBeTruthy();
    expect(widgetInstance.masterCalendar.value.id).toBe('cal_master');
    expect(widgetInstance.localCalendars.value.length).toBe(1);
    expect(widgetInstance.formattedMasterDate.value).toBeTruthy();
    wrapper.unmount();
  });

  it('computes master date and local date with edge cases', async () => {
    const widget = useGlobalCalendarWidget(props);

    // Initial state without loaded master calendar (covers line 33 via formattedMasterDate)
    expect(widget.formattedMasterDate.value).toBe('');
    expect(widget.formattedLocalDate.value).toBe('');

    // Master calendar without data
    widget.masterCalendar.value = { id: 'cal_master', is_master: true };
    expect(widget.formattedMasterDate.value).toBe('');

    // Setup master calendar and local calendars
    const store = useCalendarStore();
    const list = await store.getCalendars('my-proj');
    widget.masterCalendar.value = list.find((c: any) => c.is_master) ?? null;
    widget.localCalendars.value = [
      ...list.filter((c: any) => !c.is_master),
      { id: 'cal_nodata', is_master: false } as any,
    ];

    expect(widget.currentMasterInput.value.year).toBe(1);
    expect(widget.formattedMasterDate.value).toBeTruthy();

    // With no selected local cal
    expect(widget.formattedLocalDate.value).toBe('');

    // Select valid local calendar
    widget.selectedLocalCal.value = 'cal_local';
    expect(widget.formattedLocalDate.value).toBeTruthy();

    // Select local calendar without data
    widget.selectedLocalCal.value = 'cal_nodata';
    expect(widget.formattedLocalDate.value).toBe('');

    // Select unknown local calendar
    widget.selectedLocalCal.value = 'unknown_cal';
    expect(widget.formattedLocalDate.value).toBe('');
  });

  it('handles master calendar and local calendar without id', () => {
    const widget = useGlobalCalendarWidget(props);
    widget.masterCalendar.value = {
      id: '',
      is_master: true,
      data: { название: 'NoId Master', месяцы: [{ название: 'M', дней: 30 }], эпохи: [{ год_начала: 1, год_конца: 10 }] } as any,
    };
    expect(widget.formattedMasterDate.value).toBeTruthy();

    widget.selectedLocalCal.value = '';
    expect(widget.formattedLocalDate.value).toBe('');
  });

  it('covers prevDay, nextDay, atlas/explainer toggles, dateExplanation, copySnippet, and calendar events', async () => {
    vi.useFakeTimers();
    const reactiveProps = { project: 'my-proj' };
    let widgetInstance!: ReturnType<typeof useGlobalCalendarWidget>;
    const Comp = defineComponent({
      setup() {
        widgetInstance = useGlobalCalendarWidget(reactiveProps);
        return () => null;
      },
    });

    const wrapper = mount(Comp);
    await Promise.resolve();
    await Promise.resolve();

    // prevDay & nextDay transitions across day, month, and year boundaries
    widgetInstance.currentMasterInput.value = { era_index: 0, year: 2, month: 0, day: 1, hour: 12, minute: 0 };
    widgetInstance.prevDay();
    expect(widgetInstance.currentMasterInput.value.year).toBe(1);

    widgetInstance.nextDay();
    expect(widgetInstance.currentMasterInput.value.year).toBe(2);
    expect(widgetInstance.currentMasterInput.value.day).toBe(1);

    widgetInstance.nextDay();
    expect(widgetInstance.currentMasterInput.value.day).toBe(2);
    widgetInstance.prevDay();
    expect(widgetInstance.currentMasterInput.value.day).toBe(1);

    // Computed metadata & toggles
    expect(widgetInstance.maxDaysInCurrentMonth.value).toBe(30);
    expect(widgetInstance.maxHoursInDay.value).toBe(24);
    expect(widgetInstance.maxMinutesInHour.value).toBe(60);
    expect(widgetInstance.activeMoons.value).toEqual([]);
    expect(widgetInstance.activeHoliday.value).toBeFalsy();
    expect(widgetInstance.dateExplanation.value).toBeTruthy();

    widgetInstance.openAtlas();
    expect(widgetInstance.isAtlasOpen.value).toBe(true);
    widgetInstance.closeAtlas();
    expect(widgetInstance.isAtlasOpen.value).toBe(false);

    widgetInstance.toggleExplainer();
    expect(widgetInstance.isExplainerOpen.value).toBe(true);
    widgetInstance.closeExplainer();
    expect(widgetInstance.isExplainerOpen.value).toBe(false);

    await widgetInstance.copySnippet();
    if (widgetInstance.dateExplanation.value?.snippet) {
      expect(widgetInstance.isCopied.value).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(widgetInstance.isCopied.value).toBe(false);
    }

    // Event listeners reload calendars
    document.dispatchEvent(new CustomEvent('ww:calendar-saved'));
    document.dispatchEvent(new CustomEvent('ww:calendar-deleted'));
    document.dispatchEvent(new CustomEvent('ww:calendar-renamed'));

    // Empty project guard via mounted watcher/onMounted
    let emptyWidget!: ReturnType<typeof useGlobalCalendarWidget>;
    const EmptyComp = defineComponent({
      setup() {
        emptyWidget = useGlobalCalendarWidget({ project: '' });
        return () => null;
      },
    });
    const emptyWrapper = mount(EmptyComp);
    await Promise.resolve();
    expect(emptyWidget.masterCalendar.value).toBeNull();
    expect(emptyWidget.maxDaysInCurrentMonth.value).toBe(31);
    expect(emptyWidget.dateExplanation.value).toBeNull();
    emptyWrapper.unmount();

    // Master calendar matched by data.calendar_type === 'master' + flat месяцы without .data wrapper + moons
    const { useCalendarStore } = await import('@/stores/calendar.store');
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getCalendars').mockResolvedValueOnce([
      {
        id: 'cal_flat_master',
        name: 'Custom',
        is_master: false,
        data: {
          calendar_type: 'master',
          название: 'Плоский',
          месяцы: [{ название: 'М1', дней: 20 }],
          эпохи: [{ название: 'Э1', год_начала: 1, год_конца: 100 }],
          moons: [{ name: 'Селена', period_days: 20 }],
        },
      } as any,
      {
        id: 'cal_loc_flat',
        name: 'Локальный',
        месяцы: [{ название: 'Л1', дней: 25 }],
        эпохи: [{ название: 'Э1', год_начала: 1, год_конца: 100 }],
      } as any,
    ]);
    await widgetInstance.loadCalendars();
    expect(widgetInstance.masterCalendar.value?.id).toBe('cal_flat_master');
    expect(widgetInstance.activeMoons.value).toHaveLength(1);

    // prevDay from month > 0 and nextDay to month < last
    widgetInstance.currentMasterInput.value = { era_index: 0, year: 1, month: 0, day: 20, hour: 0, minute: 0 };
    widgetInstance.nextDay();
    widgetInstance.prevDay();
    expect(widgetInstance.currentMasterInput.value.day).toBe(20);

    wrapper.unmount();
    vi.useRealTimers();
  });
});
