/**
 * @file Tab4Playground.spec.ts
 * @description Unit-тесты для useTab4Playground
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab4Playground } from './useTab4Playground';
import type { Tab4PlaygroundProps, Tab4PlaygroundEmits } from './Tab4Playground.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab4Playground', () => {
  const mockCalendar: CalendarData = {
    название: 'Песочница Календаря',
    точка_отсчета: { эпоха: 0, год: 1024, месяц: 2, день: 15, час: 14, минута: 30 },
    месяцы: [{ название: 'Март', дней: 31 }],
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  };

  it('инициализирует точку отсчета сюжета', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const { storyOrigin } = useTab4Playground({ calendarData: mockCalendar }, emit);

    expect(storyOrigin.value.year).toBe(1024);
    expect(storyOrigin.value.month).toBe(2);
    expect(storyOrigin.value.day).toBe(15);
  });

  it('генерирует матрицу дней месяца', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const { monthMatrixDays } = useTab4Playground({ calendarData: mockCalendar }, emit);

    expect(monthMatrixDays.value.length).toBe(31);
    expect(monthMatrixDays.value[0].day).toBe(1);
    expect(monthMatrixDays.value[14].isSelected).toBe(true); // 15-й день выбран
  });

  it('обновляет точку отсчета сюжета', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const { updateOrigin } = useTab4Playground({ calendarData: mockCalendar }, emit);

    updateOrigin({ year: 2000, day: 1 });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      точка_отсчета: expect.objectContaining({ год: 2000, день: 1 }),
    }));
  });

  it('выбирает день в матрице', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const { selectMatrixDay, testDay } = useTab4Playground({ calendarData: mockCalendar }, emit);

    selectMatrixDay(20);
    expect(testDay.value).toBe(20);
  });
});
