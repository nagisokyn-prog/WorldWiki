/**
 * @file Tab3CultureLore.spec.ts
 * @description Unit-тесты для useTab3CultureLore
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab3CultureLore } from './useTab3CultureLore';
import type { Tab3CultureLoreProps, Tab3CultureLoreEmits } from './Tab3CultureLore.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab3CultureLore', () => {
  const mockCalendar: CalendarData = {
    название: 'Лор Календарь',
    сезоны: [{ название: 'Лето', месяцы: [0] }],
    праздники: [{ название: 'Солнцеворот', дата_начала: { месяц: 5, день: 21 }, дата_конца: { месяц: 5, день: 21 } }],
  };

  it('добавляет и удаляет сезоны', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { addSeason, removeSeason } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    addSeason();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      сезоны: expect.arrayContaining([expect.objectContaining({ название: 'Сезон 2' })]),
    }));

    removeSeason(0);
    expect(emit).toHaveBeenCalled();
  });

  it('добавляет и удаляет праздники', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { addHoliday, removeHoliday } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    addHoliday();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      праздники: expect.arrayContaining([expect.objectContaining({ название: 'Праздник 2' })]),
    }));

    removeHoliday(0);
    expect(emit).toHaveBeenCalled();
  });

  it('обновляет правило возраста персонажей (Спецификация 4.13)', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { updateAgeRule } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    updateAgeRule({ ratio_to_earth: 1.5, step_on_new_year: true });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      character_age_rules: expect.objectContaining({ ratio_to_earth: 1.5, step_on_new_year: true }),
    }));
  });

  it('обновляет часовой пояс календаря (Спецификация 4.11)', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { setCalendarTimezone } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    setCalendarTimezone('UTC+5');
    expect(emit).toHaveBeenCalledWith('update', { calendar_timezone: 'UTC+5' });
  });
});
