import { describe, it, expect } from 'vitest';
import { pluralize, formatFlashbackDelta, computeMabsFromDateFields, formatDiegeticDate } from './useJourneyChronology';
import { CalendarFormat } from '@/services/Calendars/calendar.format';

describe('useJourneyChronology helpers', () => {
  it('pluralizes correctly in Russian', () => {
    expect(pluralize(1, 'год', 'года', 'лет')).toBe('год');
    expect(pluralize(2, 'год', 'года', 'лет')).toBe('года');
    expect(pluralize(5, 'год', 'года', 'лет')).toBe('лет');
    expect(pluralize(21, 'год', 'года', 'лет')).toBe('год');
  });

  it('formats flashback delta correctly', () => {
    expect(formatFlashbackDelta(365 * 1440 * 2)).toBe('⏪ Флэшбек (на 2 года назад)');
    expect(formatFlashbackDelta(30 * 1440 * 3)).toBe('⏪ Флэшбек (на 3 месяца назад)');
    expect(formatFlashbackDelta(1440 * 5)).toBe('⏪ Флэшбек (на 5 дней назад)');
    expect(formatFlashbackDelta(60 * 4)).toBe('⏪ Флэшбек (на 4 часа назад)');
  });

  it('computes absolute minute from date fields and formats diegetic date', () => {
    const cal = CalendarFormat.getDefaultCalendar();
    const dateFields = { year: 2026, month: 8, day: 20, hour: 14, minute: 30 };
    const mAbs = computeMabsFromDateFields(dateFields, cal);
    expect(mAbs).not.toBeNull();

    const formatted = formatDiegeticDate(mAbs, dateFields, cal);
    expect(formatted).toBeDefined();
    expect(formatted).toContain('⏳');
    expect(formatted).toContain('День');
  });

  it('covers pluralize 11-19, formatFlashbackDelta minutes, computeMabsFromDateFields Russian keys, timeOfDay, and calculateDiegeticAge', async () => {
    const { calculateDiegeticAge } = await import('./useJourneyChronology');
    const cal = CalendarFormat.getDefaultCalendar();

    expect(pluralize(14, 'год', 'года', 'лет')).toBe('лет');
    expect(formatFlashbackDelta(30)).toBe('⏪ Флэшбек');

    expect(computeMabsFromDateFields(null, cal)).toBeNull();
    const ruMabs = computeMabsFromDateFields({ год: 1, месяц: 0, день: 1 }, cal);
    expect(ruMabs).not.toBeNull();

    // Russian keys + null mAbs + evening/night timeOfDay
    const eveningStr = formatDiegeticDate(null, { год: 1, месяц: 0, день: 2, hour: 20 }, null);
    expect(eveningStr).toContain('Вечер');

    // calculateDiegeticAge across years, days, newborn, and before birth
    expect(calculateDiegeticAge(undefined, 100, cal)).toBeNull();
    expect(calculateDiegeticAge(0, 0, cal)?.ageLabel).toBe('Новорожденный');
    expect(calculateDiegeticAge(0, 1440 * 5, cal)?.ageLabel).toContain('дн');
    expect(calculateDiegeticAge(0, 1440 * 60, cal)?.ageLabel).toContain('мес');
    expect(calculateDiegeticAge(0, 1440 * 400, cal)?.ageLabel).toContain('год');
    expect(calculateDiegeticAge(1440 * 400, 0, cal)?.isBeforeBirth).toBe(true);
  });
});
