import { DEFAULT_CALENDAR_SEASONS, type CalendarData, type WorldTimezone } from '@/services/Calendars/calendar.types';
import type { LocationSeasonChip } from './LocationAstronomyWidget.model';

export function formatTimezoneChipLabel(tz: WorldTimezone): string {
  const name = String(tz.name || tz.code || tz.id || '').trim();
  if (name.includes('UTC') || name.includes('GMT')) {
    return name;
  }
  const sign = tz.base_offset_hours >= 0 ? '+' : '';
  return `${name} (UTC${sign}${tz.base_offset_hours})`;
}

export function formatCoordinatesLabel(lat: number | null, lon: number | null): string {
  if (lat === null && lon === null) {
    return 'Не заданы (экватор / нулевой меридиан по умолчанию)';
  }
  const latStr = lat !== null ? `${Math.abs(lat)}° ${lat >= 0 ? 'с.ш.' : 'ю.ш.'}` : '0° ш.';
  const lonStr = lon !== null ? `${Math.abs(lon)}° ${lon >= 0 ? 'в.д.' : 'з.д.'}` : '0° д.';
  return `${latStr}, ${lonStr}`;
}

export function computeAvailableSeasons(
  activeCal: CalendarData | null,
  masterCal: CalendarData | null
): LocationSeasonChip[] {
  const cal = activeCal || masterCal;
  const months = cal?.месяцы;
  const rawSeasons = cal?.сезоны;
  const seasons = Array.isArray(rawSeasons) && rawSeasons.length > 0
    ? rawSeasons
    : (Array.isArray(months) && months.length === 12 ? DEFAULT_CALENDAR_SEASONS : []);
  if (!Array.isArray(seasons) || seasons.length === 0 || !Array.isArray(months) || months.length === 0) {
    return [];
  }

  return seasons.map((s) => {
    const mIdxs = (s.месяцы || []).slice().sort((a, b) => a - b);
    const firstMonth = mIdxs.length > 0 ? mIdxs[0] : 0;
    let startDay = 0;
    for (let i = 0; i < firstMonth && i < months.length; i++) {
      startDay += Number(months[i].дней) || 0;
    }
    return {
      name: s.название,
      startDay,
    };
  });
}

