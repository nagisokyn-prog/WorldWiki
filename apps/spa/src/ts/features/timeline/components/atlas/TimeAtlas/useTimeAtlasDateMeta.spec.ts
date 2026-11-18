import { describe, it, expect } from 'vitest';
import { extractCalendarData, getDateMeta } from './useTimeAtlasDateMeta';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTimeAtlasDateMeta', () => {
  it('extractCalendarData handles null, nested data, flat calendar records, and invalid objects', () => {
    expect(extractCalendarData(null)).toBeNull();
    expect(extractCalendarData(undefined)).toBeNull();
    expect(extractCalendarData({ id: 'c1', name: 'Empty' } as unknown as CalendarRecord)).toBeNull();

    const nested = extractCalendarData({
      id: 'c2',
      name: 'Nested',
      data: { ...CalendarMath.getDefaultCalendar(), название: '' },
    } as unknown as CalendarRecord);
    expect(nested?._id).toBe('c2');
    expect(nested?.название).toBe('Nested');

    const flat = extractCalendarData({
      id: 'c3',
      name: 'Flat',
      дни_в_неделе: 7,
    } as unknown as CalendarRecord);
    expect(flat?._id).toBe('c3');
    expect(flat?.название).toBe('Flat');
  });

  it('getDateMeta handles null inputs and multi-month holiday ranges', () => {
    expect(getDateMeta(null, null)).toEqual({ season: 'Вне сезона', holiday: null, moons: [] });

    const cal: CalendarData = {
      ...CalendarMath.getDefaultCalendar(),
      праздники: [
        null as unknown as NonNullable<CalendarData['праздники']>[number],
        {
          название: 'Зимний Фестиваль',
          дата_начала: { месяц: 0, день: 20 },
          дата_конца: { месяц: 2, день: 5 },
        },
      ],
    };

    // Start month boundary
    expect(getDateMeta(cal, { era_index: 0, year: 1, month: 0, day: 25, hour: 0, minute: 0 }).holiday).toBe(
      'Зимний Фестиваль'
    );
    // Middle month
    expect(getDateMeta(cal, { era_index: 0, year: 1, month: 1, day: 10, hour: 0, minute: 0 }).holiday).toBe(
      'Зимний Фестиваль'
    );
    // End month boundary
    expect(getDateMeta(cal, { era_index: 0, year: 1, month: 2, day: 3, hour: 0, minute: 0 }).holiday).toBe(
      'Зимний Фестиваль'
    );
    // Outside range
    expect(getDateMeta(cal, { era_index: 0, year: 1, month: 2, day: 10, hour: 0, minute: 0 }).holiday).toBeNull();
  });
});
