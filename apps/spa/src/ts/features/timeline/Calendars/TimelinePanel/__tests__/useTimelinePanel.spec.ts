import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTimelinePanel } from '../useTimelinePanel';

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal1',
        data: {
          название: 'Main Calendar',
          месяцы: [{ название: 'Январь', дней: 30 }],
          эпохи: [{ название: 'Эра 1', год_начала: 1, год_конца: 1000 }],
        },
      },
    ]),
  }),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useTimelinePanel', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'p1',
      events: [
        {
          date: { era: 0, year: 100, month: 0, day: 15 },
          description: 'Great War',
          calendar_id: 'cal1',
        },
      ],
    };
  });

  it('manages expanded events and options', () => {
    const panel = useTimelinePanel(props, emit);

    expect(panel.isExpanded(0)).toBe(false);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(true);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(false);

    // Options helpers
    expect(Array.isArray(panel.getEraOptions('cal1'))).toBe(true);
    expect(Array.isArray(panel.getMonthOptions('cal1'))).toBe(true);
    expect(panel.getHourOptions('cal1').length).toBe(24);
    expect(panel.getMinuteOptions('cal1').length).toBe(60);
    expect(panel.getDaysInMonth('cal1', 0)).toBe(30);
    expect(panel.getDaysInMonth('non_existent', 0)).toBe(30);

    // Toggle calendar selection
    panel.toggleCalendarSelection('cal1');
    expect(panel.selectedCalendarIds.value).toContain('cal1');
    panel.toggleCalendarSelection('cal1');
    expect(panel.selectedCalendarIds.value).not.toContain('cal1');
  });

  it('handles add, remove, and update events', () => {
    const panel = useTimelinePanel(props, emit);

    panel.addEvent();
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.removeEvent(0);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventDate(0, 'year', 200);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventDate(0, 'era', 1);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventDate(0, 'month', 2);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventDate(0, 'day', 10);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventTime(0, 'hour', 15);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.updateEventTime(0, 'minute', 45);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.onYearInput(0, { target: { value: '300' } } as any);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));

    panel.onDayInput(0, { target: { value: '20' } } as any);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));
  });

  it('handles getUniversalDateObject and updateEventFullDate', () => {
    const panel = useTimelinePanel(props, emit);

    const udo = panel.getUniversalDateObject(props.events[0]);
    expect(udo.calendar_id).toBe('cal1');
    expect(udo.original_input.year).toBe(100);

    panel.updateEventFullDate(0, {
      calendar_id: 'cal1',
      original_input: {
        era_index: 0,
        year: 150,
        month: 0,
        day: 10,
        hour: 8,
        minute: 15,
      },
    });

    expect(emit).toHaveBeenCalledWith('update:events', [
      {
        calendar_id: 'cal1',
        date: { era: 0, year: 150, month: 0, day: 10 },
        time: { hour: 8, minute: 15 },
        description: 'Great War',
      },
    ]);
  });

  it('handles getConvertedDateInfo and createNextEvent', () => {
    const panel = useTimelinePanel(props, emit);

    panel.availableCalendars.value = [
      {
        id: 'cal1',
        data: {
          название: 'Main Calendar',
          месяцы: [{ название: 'Январь', дней: 30 }],
          эпохи: [{ название: 'Эра 1', год_начала: 1, год_конца: 1000 }],
          настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
        },
      },
    ];

    const converted = panel.getConvertedDateInfo(props.events[0], 'cal1');
    expect(converted).not.toBeNull();
    expect(converted?.calName).toBe('Main Calendar');

    // createNextEvent with relative input
    panel.relativeInput.value[0] = '+1y';
    panel.createNextEvent(0);
    expect(emit).toHaveBeenCalledWith('update:events', expect.any(Array));
  });
});
