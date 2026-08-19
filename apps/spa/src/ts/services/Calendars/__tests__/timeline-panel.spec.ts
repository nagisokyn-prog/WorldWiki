import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimelinePanelComponent from '../timeline-panel';
import { useCalendarStore } from '../../stores/calendar.store';

vi.mock('../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal_1',
        is_default: true,
        data: {
          название: 'Основной',
          эпохи: [{ название: 'Первая Эпоха', год_начала: 1, год_конца: 100 }],
          месяцы: [{ название: 'Январь', дней: 30 }],
          настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 },
          точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1 },
        },
      },
    ]),
    isValidCalendar: () => true,
  }),
}));

vi.mock('@worldwiki/components', () => ({
  XboxWheel: {},
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
}));

describe('TimelinePanel (services/Calendars/timeline-panel.ts)', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('initializes setup and helpers', () => {
    const setupResult: any = (TimelinePanelComponent.setup as any)(props, { emit });

    expect(setupResult.isExpanded(0)).toBe(false);
    setupResult.toggleExpand(0);
    expect(setupResult.isExpanded(0)).toBe(true);

    const eraOpts = setupResult.getEraOptions('cal_1');
    expect(Array.isArray(eraOpts)).toBe(true);

    const hourOpts = setupResult.getHourOptions('cal_1');
    expect(hourOpts.length).toBe(24);

    const minOpts = setupResult.getMinuteOptions('cal_1');
    expect(minOpts.length).toBe(60);

    setupResult.toggleCalendarSelection('cal_1');
    expect(setupResult.selectedCalendarIds.value).toContain('cal_1');

    setupResult.onChange();
    expect(emit).toHaveBeenCalledWith('change');
  });
});
