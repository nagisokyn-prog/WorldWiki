import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarPlayground } from '../useCalendarPlayground';

describe('useCalendarPlayground', () => {
  let props: any;

  beforeEach(() => {
    props = {
      calendar: {
        название: 'Фэнтези Календарь',
        эпохи: [{ название: 'Первая Эпоха', год_начала: 1, год_конца: 100 }],
        месяцы: [
          { название: 'Месяц 1', дней: 30 },
          { название: 'Месяц 2', дней: 30 },
        ],
        дней_в_неделе: 7,
        названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        точка_отсчета: {
          эпоха: 0,
          год: 1,
          месяц: 0,
          день: 1,
          день_недели: 0,
        },
        настройки_времени: {
          часов_в_сутках: 24,
          минут_в_часе: 60,
        },
        времена_года: [
          { название: 'Зима', месяц_начала: 0, день_начала: 1 },
          { название: 'Весна', месяц_начала: 1, день_начала: 1 },
        ],
        moons: [
          {
            name: 'Селена',
            cycle: 28,
            shift: 0,
          },
        ],
        праздники: [
          {
            название: 'День Мира',
            дата_начала: { месяц: 0, день: 1 },
            дата_конца: { месяц: 0, день: 2 },
          },
          {
            название: 'Праздник Урожая',
            дата_начала: { месяц: 0, день: 25 },
            дата_конца: { месяц: 1, день: 5 },
          },
        ],
      },
    };
  });

  it('initializes default origin when missing', () => {
    const hook = useCalendarPlayground({ calendar: {} as any });
    expect(hook.origin.value).toEqual({
      эпоха: 0,
      год: 1,
      месяц: 0,
      день: 1,
      день_недели: 0,
    });
    expect(hook.daysInWeek.value).toBe(7);
    expect(hook.weekdayNames.value.length).toBe(7);
  });

  it('navigates months forward and backward across year boundaries', () => {
    const hook = useCalendarPlayground(props);

    expect(hook.origin.value.месяц).toBe(0);
    expect(hook.origin.value.год).toBe(1);

    // Prev month when at month 0 -> moves to previous year
    hook.prevMonth();
    expect(hook.origin.value.месяц).toBe(1);
    expect(hook.origin.value.год).toBe(0);

    // Next month back to month 0, year 1
    hook.nextMonth();
    expect(hook.origin.value.месяц).toBe(0);
    expect(hook.origin.value.год).toBe(1);

    // Next month to month 1, year 1
    hook.nextMonth();
    expect(hook.origin.value.месяц).toBe(1);
    expect(hook.origin.value.год).toBe(1);

    // Next month across year boundary -> month 0, year 2
    hook.nextMonth();
    expect(hook.origin.value.месяц).toBe(0);
    expect(hook.origin.value.год).toBe(2);
  });

  it('computes weekday offset and grid days accurately with moons, seasons, and holidays', () => {
    const hook = useCalendarPlayground(props);

    expect(hook.startWeekdayOffset.value).toBeGreaterThanOrEqual(0);
    expect(hook.startWeekdayOffset.value).toBeLessThan(7);

    const days = hook.gridDays.value;
    expect(days.length).toBe(30);

    // First day is origin
    expect(days[0].day).toBe(1);
    expect(days[0].isOrigin).toBe(true);
    expect(days[0].holidayText).toBe('День Мира');
    expect(days[0].seasonName).toBeDefined();
    expect(days[0].moons.length).toBeGreaterThan(0);

    // Filter toggling
    hook.filters.value.moons = false;
    hook.filters.value.seasons = false;
    hook.filters.value.holidays = false;

    const filteredDays = hook.gridDays.value;
    expect(filteredDays[0].moons).toEqual([]);
    expect(filteredDays[0].holidayText).toBe('');
  });

  it('generates rich tooltips for days with all active filters', () => {
    const hook = useCalendarPlayground(props);
    const dayWithMoons = {
      day: 1,
      seasonName: 'Зима',
      holidayText: 'День Мира',
      moons: [{ emoji: '🌕', moon: { name: 'Селена' }, name: 'Полнолуние' }],
      isOrigin: true,
    };

    const tooltip = hook.getDayTooltip(dayWithMoons);
    expect(tooltip).toContain('День 1');
    expect(tooltip).toContain('❄️ Зима');
    expect(tooltip).toContain('🎉 Праздник: День Мира');
    expect(tooltip).toContain('🌕 Селена: Полнолуние');
    expect(tooltip).toContain('🌟 Точка отсчета (День 0)');
  });

  it('identifies significant moon phases', () => {
    const hook = useCalendarPlayground(props);

    expect(hook.isSignificantPhase(0.02)).toBe(true); // New moon
    expect(hook.isSignificantPhase(0.98)).toBe(true); // End of cycle
    expect(hook.isSignificantPhase(0.50)).toBe(true); // Full moon
    expect(hook.isSignificantPhase(0.48)).toBe(true); // Near full moon
    expect(hook.isSignificantPhase(0.25)).toBe(false); // Quarter moon
  });

  it('handles multi-month holiday spanning and unknown season colors', () => {
    const spanningCalendar: any = {
      ...props.calendar,
      праздники: [
        {
          название: '3-Month Festival',
          дата_начала: { месяц: 0, день: 1 },
          дата_конца: { месяц: 2, день: 10 },
        },
      ],
      времена_года: [
        { название: 'Custom Season', месяц_начала: 0, день_начала: 1 },
      ],
    };

    const hook = useCalendarPlayground({ calendar: spanningCalendar });
    // Switch to month 1 (middle of 3-month festival)
    hook.origin.value.месяц = 1;
    const days = hook.gridDays.value;

    expect(days[0].holidayText).toBe('3-Month Festival');
    expect(days[0].seasonColor).toBe('rgba(255,255,255,0.03)'); // fallback color
  });
});


