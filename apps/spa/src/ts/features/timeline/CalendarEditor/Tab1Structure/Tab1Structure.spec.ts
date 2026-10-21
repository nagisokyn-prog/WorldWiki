/**
 * @file Tab1Structure.spec.ts
 * @description Unit-тесты для useTab1Structure (DialHierarchy, дни недели, високосы и WASM)
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab1Structure } from './useTab1Structure';
import type { Tab1StructureEmits } from './Tab1Structure.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab1Structure', () => {
  const mockCalendar: CalendarData = {
    название: 'Тестовый',
    дней_в_неделе: 7,
    первый_месяц_года: 0,
    эпохи: [{ название: 'Эра', год_начала: 1, год_конца: 9999 }],
    месяцы: [
      { название: 'Январь', дней: 31 },
      { название: 'Февраль', дней: 28 },
    ],
    названия_дней_недели: ['Пн', 'Вт', 'Ср'],
    pause_on_holidays: false,
    day_start_offset: 'midnight' as unknown as number,
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

  it('добавляет новый день через addNewDay', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { newWeekdayName, addNewDay } = useTab1Structure({ calendarData: mockCalendar }, emit);

    newWeekdayName.value = 'Лунь';
    addNewDay();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      названия_дней_недели: expect.arrayContaining(['Лунь']),
    }));
    expect(newWeekdayName.value).toBe('');
  });

  it('управляет високосами и пресетами систем через leap composable', () => {
    const emit = vi.fn() as unknown as Tab1StructureEmits;
    const { leap } = useTab1Structure(
      { calendarData: mockCalendar, planetOrbitDays: 365.2422 },
      emit
    );

    expect(leap.orbitDays.value).toBe(365.2422);

    // Пресет Шир Толкина
    leap.selectSystemPreset('tolkien');
    expect(emit).toHaveBeenCalledWith('update', { правило_високосного_года: 'каждый 4 год' });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      extra_days_config: expect.objectContaining({
        base_days: 3,
        name: 'Праздники середины года (Лите)',
        placement: 'mid_year',
        target_mode: 'in_extra_days',
      }),
    }));

    // Балансировка месяцев
    leap.balanceMonthsForExtraDays();
    expect(emit).toHaveBeenCalled();
  });
});
