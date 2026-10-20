/**
 * @file Tab1Structure.spec.ts
 * @description Unit-тесты для useTab1Structure (DialHierarchy, дни недели, високосы)
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab1Structure } from './useTab1Structure';
import type { Tab1StructureProps, Tab1StructureEmits } from './Tab1Structure.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab1Structure', () => {
  const mockCalendar: CalendarData = {
    название: 'Тестовый',
    месяцы: [
      { название: 'Январь', дней: 31 },
      { название: 'Февраль', дней: 28 },
    ],
    названия_дней_недели: ['Пн', 'Вт', 'Ср'],
    pause_on_holidays: false,
    day_start_offset: 'midnight',
  };

  it('применяет пресеты циферблата (DialHierarchy)', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { applyDialPreset } = useTab1Structure({ calendarData: mockCalendar }, emit);

    applyDialPreset('fantasy');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      dial_units: expect.arrayContaining([
        expect.objectContaining({ name: 'Стража', subdivisions: 4 }),
      ]),
    }));
  });

  it('применяет пресет недели и меняет порядок дней', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { applyWeekPreset, reorderWeekday, addCustomWeekday, removeWeekday } = useTab1Structure(
      { calendarData: mockCalendar },
      emit
    );

    applyWeekPreset(7);
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      названия_дней_недели: expect.arrayContaining(['Понедельник', 'Воскресенье']),
    }));

    reorderWeekday(0, 1);
    expect(emit).toHaveBeenCalled();

    addCustomWeekday('НовыйДень');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      названия_дней_недели: ['Пн', 'Вт', 'Ср', 'НовыйДень'],
    }));

    removeWeekday(1);
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      названия_дней_недели: ['Пн', 'Ср'],
    }));
  });

  it('устанавливает чекбокс pause_on_holidays', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { setPauseOnHolidays } = useTab1Structure({ calendarData: mockCalendar }, emit);

    setPauseOnHolidays(true);
    expect(emit).toHaveBeenCalledWith('update', { pause_on_holidays: true });
  });

  it('добавляет месяц и выравнивает дни поровну', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { addMonth, balanceMonthsEvenly } = useTab1Structure({ calendarData: mockCalendar }, emit);

    addMonth();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      месяцы: expect.arrayContaining([expect.objectContaining({ дней: 30 })]),
    }));

    balanceMonthsEvenly();
    expect(emit).toHaveBeenCalled();
  });
});
