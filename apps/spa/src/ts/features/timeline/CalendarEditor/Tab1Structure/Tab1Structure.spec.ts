import { describe, it, expect, vi } from 'vitest';
import { useTab1Structure } from './useTab1Structure';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab1Structure', () => {
  const mockCalendar: CalendarData = {
    название: 'Test Calendar',
    месяцы: [
      { название: 'Месяц 1', дней: 30 },
      { название: 'Месяц 2', дней: 31 },
    ],
    дни_недели: [
      { название: 'День 1' },
      { название: 'День 2' },
    ],
    дней_вне_месяцев: 5,
  };

  it('correctly computes months, weekdays, and totalYearDays', () => {
    const emit = vi.fn();
    const { months, weekdays, totalYearDays, extraDays } = useTab1Structure(
      { calendarData: mockCalendar },
      emit
    );

    expect(months.value.length).toBe(2);
    expect(weekdays.value.length).toBe(2);
    expect(extraDays.value).toBe(5);
    expect(totalYearDays.value).toBe(30 + 31 + 5);
  });

  it('updates months and emits update event', () => {
    const emit = vi.fn();
    const { updateMonths } = useTab1Structure(
      { calendarData: mockCalendar },
      emit
    );

    updateMonths([{ название: 'Новый месяц', дней: 28 }]);
    expect(emit).toHaveBeenCalledWith('update', {
      месяцы: [{ название: 'Новый месяц', дней: 28 }],
    });
  });

  it('balances months evenly', () => {
    const emit = vi.fn();
    const { balanceMonthsEvenly } = useTab1Structure(
      { calendarData: mockCalendar },
      emit
    );

    balanceMonthsEvenly();
    expect(emit).toHaveBeenCalledWith('update', {
      месяцы: [
        { название: 'Месяц 1', дней: 180 },
        { название: 'Месяц 2', дней: 180 },
      ],
    });
  });

  it('handles empty calendar data gracefully', () => {
    const emit = vi.fn();
    const { months, weekdays, totalYearDays } = useTab1Structure(
      { calendarData: null },
      emit
    );

    expect(months.value).toEqual([]);
    expect(weekdays.value).toEqual([]);
    expect(totalYearDays.value).toBe(0);
  });
});
