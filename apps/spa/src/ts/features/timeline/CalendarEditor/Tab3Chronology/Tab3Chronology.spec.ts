import { describe, it, expect, vi } from 'vitest';
import { useTab3Chronology } from './useTab3Chronology';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab3Chronology', () => {
  const mockCalendar: CalendarData = {
    название: 'Chronology Calendar',
    эпохи: [
      { название: 'Первая Эпоха', год_начала: 1, год_конца: 500 },
      { название: 'Вторая Эпоха', год_начала: 501, год_конца: 1000 },
    ],
    точка_отсчета: {
      эпоха: 0,
      год: 100,
      месяц: 2,
      день: 15,
    },
    праздники: [
      { название: 'Новый Год', месяц: 0, день: 1 },
    ],
  };

  it('computes eras, origin, and holidays', () => {
    const emit = vi.fn();
    const { eras, origin, holidays } = useTab3Chronology(
      { calendarData: mockCalendar },
      emit
    );

    expect(eras.value.length).toBe(2);
    expect(origin.value.год).toBe(100);
    expect(holidays.value.length).toBe(1);
  });

  it('adds and removes eras', () => {
    const emit = vi.fn();
    const { addEra, removeEra } = useTab3Chronology(
      { calendarData: mockCalendar },
      emit
    );

    addEra();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      эпохи: expect.any(Array),
    }));

    removeEra(0);
    expect(emit).toHaveBeenCalledWith('update', {
      эпохи: [mockCalendar.эпохи![1]],
    });
  });

  it('updates origin date', () => {
    const emit = vi.fn();
    const { updateOrigin } = useTab3Chronology(
      { calendarData: mockCalendar },
      emit
    );

    updateOrigin({ год: 250 });
    expect(emit).toHaveBeenCalledWith('update', {
      точка_отсчета: {
        эпоха: 0,
        год: 250,
        месяц: 2,
        день: 15,
      },
    });
  });
});
