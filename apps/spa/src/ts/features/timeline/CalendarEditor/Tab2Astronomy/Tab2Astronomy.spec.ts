import { describe, it, expect, vi } from 'vitest';
import { useTab2Astronomy } from './useTab2Astronomy';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab2Astronomy', () => {
  const mockCalendar: CalendarData = {
    название: 'Astronomy Calendar',
    сезоны: [
      { название: 'Весна', месяцы: [0, 1], цвет: '#00ff00' },
      { название: 'Лето', месяцы: [2, 3], цвет: '#ff0000' },
    ],
    луны: [
      { название: 'Луна', синодический_период: 29.53 },
    ],
    физика_планеты: {
      орбитальный_период: 365.25,
      наклон_оси: 23.5,
    },
  };

  it('computes seasons, moons, and physics', () => {
    const emit = vi.fn();
    const { seasons, moons, physics } = useTab2Astronomy(
      { calendarData: mockCalendar },
      emit
    );

    expect(seasons.value.length).toBe(2);
    expect(moons.value.length).toBe(1);
    expect(physics.value.орбитальный_период).toBe(365.25);
  });

  it('adds and removes a season', () => {
    const emit = vi.fn();
    const { addSeason, removeSeason } = useTab2Astronomy(
      { calendarData: mockCalendar },
      emit
    );

    addSeason();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      сезоны: expect.any(Array),
    }));

    removeSeason(0);
    expect(emit).toHaveBeenCalledWith('update', {
      сезоны: [mockCalendar.сезоны![1]],
    });
  });

  it('updates physics parameters', () => {
    const emit = vi.fn();
    const { updatePhysics } = useTab2Astronomy(
      { calendarData: mockCalendar },
      emit
    );

    updatePhysics({ наклон_оси: 15.0 });
    expect(emit).toHaveBeenCalledWith('update', {
      физика_планеты: {
        орбитальный_период: 365.25,
        наклон_оси: 15.0,
      },
    });
  });
});
