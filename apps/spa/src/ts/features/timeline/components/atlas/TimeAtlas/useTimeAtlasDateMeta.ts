import type { CalendarData, CalendarDate, MoonPhaseResult } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

export function extractCalendarData(rec: CalendarRecord | null | undefined): CalendarData | null {
  if (!rec) return null;
  if (rec.data && typeof rec.data === 'object' && Object.keys(rec.data).length > 0) {
    return {
      ...rec.data,
      _id: rec.id || rec.data._id,
      название: rec.data.название || rec.name || 'Календарь'
    } as CalendarData;
  }
  if ('дни_в_неделе' in rec || 'месяцы' in rec || 'эпохи' in rec) {
    return {
      ...(rec as unknown as CalendarData),
      _id: rec.id,
      название: (rec as unknown as CalendarData).название || rec.name || 'Календарь'
    };
  }
  return null;
}

export function getDateMeta(cal?: CalendarData | null, date?: CalendarDate['original_input'] | null) {
  if (!cal || !date) {
    return { season: 'Вне сезона', holiday: null, moons: [] };
  }
  const safeYear = date.year ?? 1;
  const safeMonth = date.month ?? 0;
  const safeDay = date.day ?? 1;

  let season: string;
  try {
    season = CalendarMath.getSeasonForDate(cal, safeYear, safeMonth) || 'Вне сезона';
  } catch {
    season = 'Вне сезона';
  }

  let holiday: string | null = null;
  if (cal.праздники && Array.isArray(cal.праздники)) {
    for (const h of cal.праздники) {
      if (!h || !h.дата_начала) continue;
      const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
      const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
      if (safeMonth >= sm && safeMonth <= em) {
        if (safeMonth === sm && safeMonth === em) {
          if (safeDay >= sd && safeDay <= ed) { holiday = h.название; break; }
        } else if (safeMonth === sm) {
          if (safeDay >= sd) { holiday = h.название; break; }
        } else if (safeMonth === em) {
          if (safeDay <= ed) { holiday = h.название; break; }
        } else {
          holiday = h.название; break;
        }
      }
    }
  }

  let moons: MoonPhaseResult[];
  try {
    const absMin = CalendarMath.getAbsoluteMinute(date, cal);
    moons = CalendarMath.calculateMoonPhases(absMin, cal.moons || [], cal);
  } catch {
    moons = [];
  }

  return { season, holiday, moons };
}

