/**
 * @file Tab4Playground.spec.ts
 * @description Unit-тесты для useTab4Playground
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab4Playground } from './useTab4Playground';
import type { Tab4PlaygroundEmits } from './Tab4Playground.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab4Playground', () => {
  const mockCalendar: CalendarData = {
    название: 'Песочница Календаря',
    дней_в_неделе: 7,
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    первый_месяц_года: 0,
    месяцы: [{ название: 'Март', дней: 31 }],
    эпохи: [{ название: 'Эра', год_начала: 1, год_конца: 9999 }],
    точка_отсчета: { эпоха: 0, год: 1024, месяц: 2, день: 15, день_недели: 0, час: 14, минута: 30 } as unknown as CalendarData['точка_отсчета'],
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

    const regularDays = monthMatrixDays.value.filter(d => !d.isPadding);
    expect(regularDays.length).toBe(30);
    expect(regularDays[0].day).toBe(1);
    expect(regularDays[14].isSelected).toBe(true); // 15-й день выбран
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

  it('синхронизирует testYear и заголовок месяца при updateOrigin', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const { updateOrigin, currentMonthTitle } = useTab4Playground({ calendarData: mockCalendar }, emit);

    updateOrigin({ year: 1566 });
    expect(currentMonthTitle.value).toContain('1566');
  });

  it('covers missing точка_отсчета defaults, multi-month matrix, and computed formatting', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const minCal: CalendarData = {
      ...mockCalendar,
      точка_отсчета: undefined,
      месяцы: [
        { название: 'М1', дней: 28 },
        { название: 'М2', дней: 30 }
      ]
    };

    const pg = useTab4Playground({ calendarData: minCal }, emit);
    expect(pg.storyOrigin.value.year).toBe(1024);
    expect(pg.monthMatrixDays.value.length).toBeGreaterThan(20);
    pg.testMonth.value = 1;
    pg.selectMatrixDay(10);
    expect(pg.testDay.value).toBe(10);
  });

  it('switches prevMonth/nextMonth across year boundaries and computes liveCalculation & fallbacks', () => {
    const emit = vi.fn() as unknown as Tab4PlaygroundEmits;
    const minCal: CalendarData = {
      ...mockCalendar,
      месяцы: [],
      названия_дней_недели: [],
      эпохи: undefined,
      точка_отсчета: { эпоха: 0, год: 1024, месяц: 0, день: 1, день_недели: 0, час: 0, минута: 0 } as unknown as CalendarData['точка_отсчета'],
    };

    const pg = useTab4Playground({ calendarData: minCal }, emit);
    expect(pg.monthNames.value.length).toBe(12);
    expect(pg.weekdayNames.value.length).toBe(7);
    expect(pg.weekdayHeaders.value.length).toBe(7);
    expect(pg.liveCalculation.value).not.toBeNull();

    pg.testMonth.value = 0;
    pg.prevMonth();
    expect(pg.testYear.value).toBe(1023);
    expect(pg.testMonth.value).toBe(11);

    pg.nextMonth();
    expect(pg.testYear.value).toBe(1024);
    expect(pg.testMonth.value).toBe(0);

    pg.nextMonth();
    expect(pg.testMonth.value).toBe(1);

    pg.prevMonth();
    expect(pg.testMonth.value).toBe(0);

    const emptyPg = useTab4Playground({ calendarData: undefined as unknown as CalendarData }, emit);
    expect(emptyPg.liveCalculation.value).toBeNull();
    expect(emptyPg.monthMatrixDays.value).toEqual([]);
  });
});
