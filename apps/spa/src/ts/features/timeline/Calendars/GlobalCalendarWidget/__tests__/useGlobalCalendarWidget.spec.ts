import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useGlobalCalendarWidget } from '../useGlobalCalendarWidget';
import { useCalendarStore } from '../../../../../stores/calendar.store';

vi.mock('../../../../../stores/calendar.store', () => ({
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

    // Initial state without loaded master calendar
    expect(widget.formattedMasterDate.value).toBe('');
    expect(widget.formattedLocalDate.value).toBe('');

    // Master calendar without data
    widget.masterCalendar.value = { id: 'cal_master', is_master: true };
    expect(widget.formattedMasterDate.value).toBe('');

    // Setup master calendar and local calendars
    const store = useCalendarStore();
    const list = await store.getCalendars('my-proj');
    widget.masterCalendar.value = list.find((c: any) => c.is_master);
    widget.localCalendars.value = [
      ...list.filter((c: any) => !c.is_master),
      { id: 'cal_nodata', is_master: false, data: null },
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
});
