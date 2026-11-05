import type { CalendarData, WorldTimezone } from '@/services/Calendars/calendar.types';
import type { LocationSeasonChip } from './LocationAstronomyWidget.model';

export function getSeasonIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('зим')) return '❄️';
  if (lower.includes('весн')) return '🌸';
  if (lower.includes('лет')) return '☀️';
  if (lower.includes('осен')) return '🍂';
  return '🌿';
}

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
  const seasons = cal?.сезоны;
  const months = cal?.месяцы;
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
      icon: getSeasonIcon(s.название),
      startDay,
    };
  });
}

