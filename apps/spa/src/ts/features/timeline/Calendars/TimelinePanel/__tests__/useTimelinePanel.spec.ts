import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useTimelinePanel } from '../useTimelinePanel';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { settingsService } from '@worldwiki/components';

let mockGetCalendars: any;
let mockSettingsCb: any;

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: (...args: any[]) => mockGetCalendars(...args),
    isValidCalendar: () => true,
  }),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn((cb) => { mockSettingsCb = cb; }),
  },
}));

describe('useTimelinePanel', () => {
  let props: any;
  let emit: any;

  const mockCalendar = {
    id: 'cal1',
    is_default: true,
    data: {
      название: 'Main Calendar',
      месяцы: [
        { название: 'Весенний', дней: 30 },
        { название: 'Летний', дней: 31 },
        { название: 'Осенний', дней: 30 },
        { название: 'Зимний', дней: 31 },
      ],
      сезоны: [
        { название: 'Весна', месяцы: [0] },
        { название: 'Лето', месяцы: [1] },
        { название: 'Осень', месяцы: [2] },
        { название: 'Зима', месяцы: [3] },
      ],
      эпохи: [{ название: 'Эра 1', год_начала: 1, год_конца: 1000 }],
      настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
      точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    mockGetCalendars = vi.fn().mockResolvedValue([mockCalendar]);
    props = {
      project: 'p1',
      events: [
        {
          date: { era: 0, year: 100, month: 0, day: 15 },
          time: { hour: 14, minute: 30 },
          description: 'Great War',
          calendar_id: 'cal1',
        },
      ],
    };
  });

  it('mounts, auto-creates first event when events is empty, and handles settings change', async () => {
    const emptyProps = { project: 'p1', events: [] };
    const TestComp = defineComponent({
      props: ['project', 'events'],
      emits: ['update:events', 'change'],
      setup(p, { emit: e }) {
        return { ...useTimelinePanel(p as any, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props: emptyProps });
    await flushPromises();

    expect(wrapper.emitted('update:events')).toBeDefined();

    if (mockSettingsCb) {
      mockSettingsCb({ dropdowns: { wheelOrientation: 'vertical' } });
      expect((wrapper.vm as any).wheelHorizontal).toBe(false);
    }
  });

  it('handles calendar fetch error in onMounted with fallback defaults', async () => {
    mockGetCalendars.mockRejectedValueOnce(new Error('Network error'));
    const emptyProps = { project: 'p1', events: [] };
    const TestComp = defineComponent({
      props: ['project', 'events'],
      emits: ['update:events', 'change'],
      setup(p, { emit: e }) {
        return { ...useTimelinePanel(p as any, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props: emptyProps });
    await flushPromises();

    expect(wrapper.emitted('update:events')).toBeDefined();
  });

  it('converts date info across seasons, times of day, and invalid calendar IDs', () => {
    const panel = useTimelinePanel(props, emit);
    panel.availableCalendars.value = [mockCalendar];

    // Invalid calendar IDs
    expect(panel.getConvertedDateInfo(props.events[0], 'non_existent')).toBeNull();

    // Morning
    const morningEvent = {
      date: { era: 0, year: 100, month: 0, day: 15 },
      time: { hour: 7, minute: 0 },
      description: 'Morning Event',
      calendar_id: 'cal1',
    };
    const morningInfo = panel.getConvertedDateInfo(morningEvent, 'cal1');
    expect(morningInfo?.timeOfDayName).toBe('🌅 Утро');
    expect(morningInfo?.seasonName).toBe('Весна');

    // Day
    const dayEvent = {
      date: { era: 0, year: 100, month: 1, day: 15 },
      time: { hour: 13, minute: 0 },
      description: 'Day Event',
      calendar_id: 'cal1',
    };
    const dayInfo = panel.getConvertedDateInfo(dayEvent, 'cal1');
    expect(dayInfo?.timeOfDayName).toBe('☀️ День');
    expect(dayInfo?.seasonName).toBe('Лето');

    // Evening
    const eveningEvent = {
      date: { era: 0, year: 100, month: 2, day: 15 },
      time: { hour: 19, minute: 0 },
      description: 'Evening Event',
      calendar_id: 'cal1',
    };
    const eveningInfo = panel.getConvertedDateInfo(eveningEvent, 'cal1');
    expect(eveningInfo?.timeOfDayName).toBe('🌆 Вечер');
    expect(eveningInfo?.seasonName).toBe('Осень');

    // Night
    const nightEvent = {
      date: { era: 0, year: 100, month: 3, day: 15 },
      time: { hour: 2, minute: 0 },
      description: 'Night Event',
      calendar_id: 'cal1',
    };
    const nightInfo = panel.getConvertedDateInfo(nightEvent, 'cal1');
    expect(nightInfo?.timeOfDayName).toBe('🌙 Ночь');
    expect(nightInfo?.seasonName).toBe('Зима');
  });

  it('handles addEvent with empty list vs existing events list', () => {
    const emptyProps = { project: 'p1', events: [] };
    const panelEmpty = useTimelinePanel(emptyProps, emit);
    panelEmpty.availableCalendars.value = [mockCalendar];
    panelEmpty.addEvent();
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    const panelExisting = useTimelinePanel(props, emit);
    panelExisting.availableCalendars.value = [mockCalendar];
    panelExisting.addEvent();
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));
  });

  it('handles createNextEvent with relative inputs and guards against missing input/calendar', () => {
    const panel = useTimelinePanel(props, emit);
    panel.availableCalendars.value = [mockCalendar];

    // No input -> no-op
    panel.createNextEvent(0);

    // Valid relative input
    panel.relativeInput.value[0] = '+2d';
    panel.createNextEvent(0);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));
  });

  it('handles updateEventFullDate guards and option helpers with missing data', () => {
    const panel = useTimelinePanel(props, emit);

    // Guard on null
    panel.updateEventFullDate(0, null);
    panel.updateEventFullDate(0, {});

    // Empty options on unknown calendar
    expect(panel.getEraOptions('unknown')).toEqual([]);
    expect(panel.getMonthOptions('unknown')).toEqual([]);
  });
});
