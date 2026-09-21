/**
 * @file useLegacyTimelineHelpers.ts
 * @description Вспомогательные функции конвертации и генерации опций для LegacyTimelinePanel
 */

import { CalendarMath } from './calendar.math';
import type { CalendarData, CalendarEra, CalendarMonth } from './calendar.types';
import type { TimelineEvent } from './useLegacyTimelinePanel';

export function getLegacyConvertedDateInfo(
  event: TimelineEvent,
  targetCalId: string,
  getCalendar: (calId?: string) => CalendarData | undefined
) {
  const sourceCal = getCalendar(event.calendar_id);
  const targetCal = getCalendar(targetCalId);

  if (!sourceCal || !targetCal) return null;

  const inputObj = {
    era_index: event.date.era,
    year: event.date.year,
    month: event.date.month,
    day: event.date.day,
    hour: event.time?.hour || 0,
    minute: event.time?.minute || 0
  };

  const absMin = CalendarMath.getAbsoluteMinute(inputObj, sourceCal);
  const localDate = CalendarMath.getDateFromAbsolute(absMin, targetCal);

  const season = CalendarMath.getSeasonForDate(targetCal, localDate.year, localDate.month);
  const seasonColors: Record<string, string> = {
    'Весна': 'rgba(34, 197, 94, 0.3)',
    'Лето': 'rgba(245, 158, 11, 0.3)',
    'Осень': 'rgba(239, 68, 68, 0.3)',
    'Зима': 'rgba(59, 130, 246, 0.3)',
  };
  const seasonColor = seasonColors[season] || 'rgba(139, 92, 246, 0.2)';

  const era = targetCal.эпохи?.[localDate.era_index];
  const month = targetCal.месяцы?.[localDate.month];
  let dateStr = `${localDate.year} год, ${month?.название || 'Месяц'} ${localDate.day}`;
  if (era) dateStr += ` (${era.название})`;

  if (event.time?.hour !== undefined) {
    dateStr += `, ${String(localDate.hour || 0).padStart(2, '0')}:${String(localDate.minute || 0).padStart(2, '0')}`;
  }

  const hour = localDate.hour || 0;
  let timeOfDayName = '🌙 Ночь';
  let timeOfDayColor = 'rgba(59, 130, 246, 0.3)';

  if (hour >= 5 && hour < 12) { timeOfDayName = '🌅 Утро'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }
  else if (hour >= 12 && hour < 17) { timeOfDayName = '☀️ День'; timeOfDayColor = 'rgba(251, 191, 36, 0.3)'; }
  else if (hour >= 17 && hour < 21) { timeOfDayName = '🌆 Вечер'; timeOfDayColor = 'rgba(249, 115, 22, 0.3)'; }

  return {
    seasonName: season || 'Без сезона',
    seasonColor,
    timeOfDayName,
    timeOfDayColor,
    dateStr,
    calName: targetCal.название || 'Календарь',
    isNative: event.calendar_id === targetCalId
  };
}

export function getLegacyOptionHelpers(getCalendar: (calId?: string) => CalendarData | undefined) {
  const getEraOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    if (!cal || !cal.эпохи) return [];
    return cal.эпохи.map((era: CalendarEra, idx: number) => ({
      value: idx,
      label: era.название || (era as unknown as { name?: string }).name || `Эра ${idx + 1}`
    }));
  };

  const getMonthOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    if (!cal || !cal.месяцы) return [];
    return cal.месяцы.map((month: CalendarMonth, idx: number) => ({
      value: idx,
      label: month.название || (month as unknown as { name?: string }).name || `Месяц ${idx + 1}`
    }));
  };

  const getHourOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    const hoursInDay = cal?.настройки_времени?.часов_в_сутках || 24;
    return Array.from({ length: hoursInDay }, (_, i) => ({
      value: i,
      label: `${String(i).padStart(2, '0')}`
    }));
  };

  const getMinuteOptions = (calId?: string) => {
    const cal = getCalendar(calId);
    const minsInHour = cal?.настройки_времени?.минут_в_часе || 60;
    return Array.from({ length: minsInHour }, (_, i) => ({
      value: i,
      label: `${String(i).padStart(2, '0')}`
    }));
  };

  const getDaysInMonth = (calId: string | undefined, monthIdx: number): number => {
    const cal = getCalendar(calId);
    if (!cal) return 30;
    return cal.месяцы?.[monthIdx]?.дней || 30;
  };

  return {
    getEraOptions,
    getMonthOptions,
    getHourOptions,
    getMinuteOptions,
    getDaysInMonth
  };
}
