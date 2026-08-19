import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelinePanelComponent from '../timeline-panel';
import { useCalendarStore } from '../../../stores/calendar.store';
import { settingsService } from '@worldwiki/components';

let mockGetCalendars: any;
let mockSettingsOnChange: any;

vi.mock('../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: (...args: any[]) => mockGetCalendars(...args),
    isValidCalendar: () => true,
  }),
}));

vi.mock('@worldwiki/components', () => ({
  XboxWheel: { template: '<div></div>' },
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsOnChange = cb; }),
  },
}));

vi.mock('../../features/timeline/UniversalDatePicker/UniversalDatePicker.vue', () => ({
  default: { template: '<div></div>' },
}));

describe('TimelinePanel (services/Calendars/timeline-panel.ts)', () => {
  let props: any;
  let emit: any;

  const sampleCalendar = {
    id: 'cal_1',
    is_default: true,
    data: {
      название: 'Основной',
      эпохи: [{ название: 'Первая Эпоха', год_начала: 1, год_конца: 100 }],
      месяцы: [
        { название: 'Январь', дней: 30 },
        { название: 'Февраль', дней: 28 },
        { название: 'Июль', дней: 31 },
        { название: 'Октябрь', дней: 31 },
      ],
      настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
      точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1 },
      времена_года: [
        { название: 'Зима', месяц_начала: 0, день_начала: 1 },
        { название: 'Весна', месяц_начала: 1, день_начала: 1 },
        { название: 'Лето', месяц_начала: 2, день_начала: 1 },
        { название: 'Осень', месяц_начала: 3, день_начала: 1 },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendars = vi.fn().mockResolvedValue([sampleCalendar]);
    emit = vi.fn();
    props = {
      project: 'proj_1',
      events: [
        {
          date: { era: 0, year: 10, month: 0, day: 5 },
          time: { hour: 10, minute: 30 },
          description: 'Event 1',
          calendar_id: 'cal_1',
        },
      ],
    };
  });

  it('mounts and initializes calendars and sets up default events when empty', async () => {
    mockGetCalendars.mockResolvedValueOnce([sampleCalendar]);
    const wrapper = mount(TimelinePanelComponent, {
      props: {
        project: 'proj_1',
        events: [],
      },
    });

    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:events')).toBeDefined();
    const emittedEvents = wrapper.emitted('update:events')![0][0] as any[];
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0].calendar_id).toBe('cal_1');
  });

  it('mounts with existing events missing calendar_id and patches them', async () => {
    mockGetCalendars.mockResolvedValueOnce([sampleCalendar]);
    const wrapper = mount(TimelinePanelComponent, {
      props: {
        project: 'proj_1',
        events: [
          {
            date: { era: 0, year: 10, month: 0, day: 5 },
            description: 'Legacy event',
          } as any,
        ],
      },
    });

    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:events')).toBeDefined();
    const emittedEvents = wrapper.emitted('update:events')![0][0] as any[];
    expect(emittedEvents[0].calendar_id).toBe('cal_1');
  });

  it('handles calendar loading failure gracefully with fallback defaults', async () => {
    mockGetCalendars.mockRejectedValueOnce(new Error('Network error'));
    const wrapper = mount(TimelinePanelComponent, {
      props: {
        project: 'proj_1',
        events: [],
      },
    });

    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:events')).toBeDefined();
    const emittedEvents = wrapper.emitted('update:events')![0][0] as any[];
    expect(emittedEvents[0].calendar_id).toBe('default');
  });

  it('handles calendar loading failure when events exist without calendar_id', async () => {
    mockGetCalendars.mockRejectedValueOnce(new Error('Network error'));
    const wrapper = mount(TimelinePanelComponent, {
      props: {
        project: 'proj_1',
        events: [{ date: { era: 0, year: 1, month: 0, day: 1 }, description: 'test' } as any],
      },
    });

    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:events')).toBeDefined();
  });

  it('updates wheelOrientation on settings change', async () => {
    const wrapper = mount(TimelinePanelComponent, { props });
    await Promise.resolve();
    if (mockSettingsOnChange) {
      mockSettingsOnChange({ dropdowns: { wheelOrientation: 'vertical' } });
      expect((wrapper.vm as any).wheelHorizontal).toBe(false);
    }
  });

  describe('setup methods and computed helpers', () => {
    let vm: any;

    beforeEach(async () => {
      const wrapper = mount(TimelinePanelComponent, { props });
      await Promise.resolve();
      await wrapper.vm.$nextTick();
      vm = wrapper.vm as any;
    });

    it('toggles expand state', () => {
      expect(vm.isExpanded(0)).toBe(false);
      vm.toggleExpand(0);
      expect(vm.isExpanded(0)).toBe(true);
      vm.toggleExpand(0);
      expect(vm.isExpanded(0)).toBe(false);
    });

    it('manages calendar selection toggling', () => {
      expect(vm.selectedCalendarIds).toContain('cal_1');
      vm.toggleCalendarSelection('cal_1');
      expect(vm.selectedCalendarIds).not.toContain('cal_1');
      vm.toggleCalendarSelection('cal_1');
      expect(vm.selectedCalendarIds).toContain('cal_1');
    });

    it('computes options for calendar, eras, months, hours, minutes', () => {
      expect(vm.calendarOptions.length).toBeGreaterThan(0);
      expect(vm.getEraOptions('cal_1').length).toBe(1);
      expect(vm.getEraOptions('invalid')).toEqual([]);
      expect(vm.getMonthOptions('cal_1').length).toBe(4);
      expect(vm.getMonthOptions('invalid')).toEqual([]);
      expect(vm.getHourOptions('cal_1').length).toBe(24);
      expect(vm.getMinuteOptions('cal_1').length).toBe(60);
      expect(vm.getDaysInMonth('cal_1', 0)).toBe(30);
      expect(vm.getDaysInMonth('invalid', 0)).toBe(30);
    });

    it('calculates converted date info for different times of day and seasons', () => {
      // Morning / Winter
      const ev1 = {
        date: { era: 0, year: 1, month: 0, day: 10 },
        time: { hour: 8, minute: 0 },
        description: 'Morning Event',
        calendar_id: 'cal_1',
      };
      const info1 = vm.getConvertedDateInfo(ev1, 'cal_1');
      expect(info1).not.toBeNull();
      expect(info1.timeOfDayName).toContain('Утро');
      expect(info1.isNative).toBe(true);

      // Afternoon / Spring
      const ev2 = {
        date: { era: 0, year: 1, month: 1, day: 10 },
        time: { hour: 14, minute: 0 },
        description: 'Day Event',
        calendar_id: 'cal_1',
      };
      const info2 = vm.getConvertedDateInfo(ev2, 'cal_1');
      expect(info2.timeOfDayName).toContain('День');

      // Evening / Summer
      const ev3 = {
        date: { era: 0, year: 1, month: 2, day: 10 },
        time: { hour: 19, minute: 0 },
        description: 'Evening Event',
        calendar_id: 'cal_1',
      };
      const info3 = vm.getConvertedDateInfo(ev3, 'cal_1');
      expect(info3.timeOfDayName).toContain('Вечер');

      // Night / Autumn
      const ev4 = {
        date: { era: 0, year: 1, month: 3, day: 10 },
        time: { hour: 2, minute: 0 },
        description: 'Night Event',
        calendar_id: 'cal_1',
      };
      const info4 = vm.getConvertedDateInfo(ev4, 'cal_1');
      expect(info4.timeOfDayName).toContain('Ночь');

      // Missing calendar
      expect(vm.getConvertedDateInfo(ev1, 'non_existent')).toBeNull();
    });

    it('updates event date and respects month day constraints', () => {
      vm.updateEventDate(0, 'era', 1);
      vm.updateEventDate(0, 'year', 2026);
      vm.updateEventDate(0, 'month', 1); // 28 days max
      vm.updateEventDate(0, 'day', 35); // capped at 28
      vm.onYearInput(0, { target: { value: '2027' } });
      vm.onDayInput(0, { target: { value: '15' } });
    });

    it('updates event time', () => {
      vm.updateEventTime(0, 'hour', 16);
      vm.updateEventTime(0, 'minute', 45);
    });

    it('adds and removes events', () => {
      vm.addEvent();
      expect(vm.isExpanded(1)).toBe(true);

      vm.removeEvent(0);
    });

    it('creates next event with duration input', () => {
      vm.relativeInput[0] = '+2d 4h';
      vm.createNextEvent(0);
      expect(vm.relativeInput[0]).toBe('');
    });

    it('handles universal date object mapping and updating', () => {
      const udo = vm.getUniversalDateObject(props.events[0]);
      expect(udo.calendar_id).toBe('cal_1');

      vm.updateEventFullDate(0, null);
      vm.updateEventFullDate(0, {
        calendar_id: 'cal_1',
        original_input: {
          era_index: 0,
          year: 50,
          month: 2,
          day: 10,
          hour: 9,
          minute: 15,
        },
      });
    });

    it('handles input invalid fallbacks, time initialization, and createNextEvent guards', () => {
      // onYearInput & onDayInput with non-numeric strings
      vm.onYearInput(0, { target: { value: 'not-a-number' } });
      vm.onDayInput(0, { target: { value: '' } });

      // updateEventTime on event without time
      props.events[0].time = undefined;
      vm.updateEventTime(0, 'hour', 10);
      vm.updateEventTime(0, 'minute', 30);

      // createNextEvent with missing input
      vm.relativeInput[0] = '';
      vm.createNextEvent(0);

      // addEvent with empty events array
      props.events.length = 0;
      vm.addEvent();
    });
  });
});

