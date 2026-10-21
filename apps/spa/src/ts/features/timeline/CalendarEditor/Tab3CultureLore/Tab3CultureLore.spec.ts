/**
 * @file Tab3CultureLore.spec.ts
 * @description Unit-тесты для useTab3CultureLore (Сезоны, праздники, фазы луны, возраст, регионы)
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab3CultureLore } from './useTab3CultureLore';
import type { Tab3CultureLoreEmits } from './Tab3CultureLore.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab3CultureLore', () => {
  const mockCalendar: CalendarData = {
    название: 'Лор Календарь',
    дней_в_неделе: 7,
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    первый_месяц_года: 0,
    месяцы: [{ название: 'Январь', дней: 31 }],
    эпохи: [{ название: 'Новая Эра', год_начала: 1, год_конца: 9999 }],
    сезоны: [{ название: 'Лето', цвет: '#f59e0b', hemisphere: 'northern', месяцы: [0] }],
    праздники: [{ название: 'Солнцеворот', дата_начала: { месяц: 5, день: 21 }, is_range: false }],
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

  it('обновляет правило возраста персонажей', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { updateAgeRule } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    updateAgeRule({ age_at_birth: 1, step_on_new_year: true, year_only: true });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      character_age_rules: expect.objectContaining({ age_at_birth: 1, step_on_new_year: true, year_only: true }),
    }));
  });

  it('управляет регионами распространения', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { toggleRegion, addRegion } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    toggleRegion('desert');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      culture_regions: expect.arrayContaining(['desert']),
    }));

    addRegion('Новая Провинция');
    expect(emit).toHaveBeenCalled();
  });
});
