/**
 * @file calendarStore.utils.ts
 * @description Вспомогательные функции, нормализаторы ID и базовые структуры данных календарей.
 */

import type { CalendarData, PlanetEntity } from '@/services/Calendars/calendar.types';

export interface CalendarRecord {
  id?: string;
  name?: string;
  is_default?: boolean;
  is_master?: boolean;
  data?: CalendarData & { [key: string]: unknown };
  [key: string]: unknown;
}

export function getDefaultPlanet(projectName: string): PlanetEntity {
  return {
    id: 'earth',
    project_id: projectName,
    name: 'Земля',
    ticks_per_day: 86400,
    orbit_days: 365.2422,
    axial_tilt: 23.44,
    is_retrograde: false,
    solstice_world_day: 355,
    timezones: [
      { id: 'tz_utc', name: 'Гринвич (UTC)', code: 'UTC', base_offset_hours: 0 },
      { id: 'tz_msk', name: 'Москва (MSK)', code: 'MSK', base_offset_hours: 3 },
    ],
    regions: [{
      id: 'reg_default',
      name: 'Умеренные широты',
      timezone_id: 'tz_utc',
      latitude: 55.75,
      longitude: 37.61,
      summer_day_hours: 17.5,
      winter_day_hours: 7.0,
    }],
    moons: [{
      name: 'Луна',
      period_days: 29.53,
      period_days_num: 2953,
      period_days_den: 100,
      initial_phase: 0,
      initial_phase_bp: 0,
    }],
  };
}

export function normalizeCalendarId(id: unknown): string {
  if (!id) return '';
  if (typeof id === 'string') {
    const s = id.includes('{String:') ? id.replace(/.*String:"?([^"]+)"?.*/, '$1') : id;
    return s.replace(/["'⟨⟩]/g, '').trim();
  }
  if (typeof id === 'object') {
    const obj = id as Record<string, unknown>;
    if (obj.tb && obj.id) {
      const inner = typeof obj.id === 'object' && obj.id !== null
        ? ((obj.id as Record<string, unknown>).String ?? (obj.id as Record<string, unknown>).Int ?? JSON.stringify(obj.id))
        : obj.id;
      return `${obj.tb}:${String(inner).replace(/["'⟨⟩]/g, '')}`.trim();
    }
    if (obj.String) return String(obj.String).replace(/["'⟨⟩]/g, '').trim();
  }
  return String(id).replace(/["'⟨⟩]/g, '').trim();
}

