/**
 * @file planetEditor.utils.ts
 * @description Вспомогательные функции, мапперы и пресеты для редактора планеты.
 */

import type {
  PlanetDto,
  PlanetSolstices,
  PlanetTimezone,
  PlanetRegion,
} from './PlanetEditor.model';
import type { PlanetEntity } from '@/services/Calendars/calendar.types';

export function toPlanetEntity(p: PlanetDto, projectId: string): PlanetEntity {
  return {
    id: p.id || 'earth',
    project_id: projectId,
    name: p.name,
    ticks_per_day: p.ticks_per_day,
    orbit_days: p.orbit_days,
    axial_tilt: p.axial_tilt_mdeg / 1000,
    is_retrograde: p.rotation_direction === 'retrograde',
    timezones: p.timezones.map((tz, idx) => ({
      id: `tz_${idx}`,
      name: tz.name,
      code: tz.code,
      base_offset_hours: tz.offset_hours,
      dst_rule: tz.dst_rule,
    })),
    regions: p.regions.map((r, idx) => ({
      id: `reg_${idx}`,
      name: r.name,
      timezone_id: r.timezone_code,
      latitude: r.latitude,
      longitude: r.longitude,
      summer_day_hours: parseFloat(r.max_day_hours || '12') || 12,
      winter_day_hours: parseFloat(r.min_day_hours || '12') || 12,
    })),
    moons: p.moons.map((m) => ({
      name: m.name,
      period_days: m.orbital_period,
      period_days_num: Math.round(m.orbital_period * 100),
      period_days_den: 100,
      initial_phase: m.start_phase,
      initial_phase_bp: Math.round(m.start_phase * 10000),
    })),
  };
}

export function createDefaultPlanetDto(planetId?: string | null): PlanetDto {
  return {
    id: planetId || null,
    name: planetId && planetId !== 'earth' ? planetId : 'Планета',
    icon: '🪐',
    ticks_per_day: 86400,
    day_hours: 24,
    day_minutes: 0,
    day_seconds: 0,
    orbit_days_num: 3652422,
    orbit_days_den: 10000,
    orbit_days: 365.2422,
    axial_tilt_mdeg: 23440,
    rotation_direction: 'direct',
    solstices: {
      winter: 355.0,
      spring: 80.0,
      summer: 172.0,
      autumn: 266.0,
    },
    timezones: [
      { name: 'Столичный меридиан', code: 'UTC+0', offset_hours: 0.0, dst_rule: 'eu' },
      { name: 'Восточный рубеж', code: 'UTC+3', offset_hours: 3.0, dst_rule: 'none' },
      { name: 'Дальний Архипелаг', code: 'UTC+8', offset_hours: 8.0, dst_rule: 'none' },
      { name: 'Западные Земли', code: 'UTC-5', offset_hours: -5.0, dst_rule: 'us' },
    ],
    regions: [
      {
        name: 'Столица Империи',
        timezone_code: 'UTC+0',
        latitude: 55.75,
        longitude: 37.61,
        max_day_hours: '17ч 34м',
        min_day_hours: '7ч 12м',
      },
      {
        name: 'Южная Гавань',
        timezone_code: 'UTC+3',
        latitude: 30.2,
        longitude: 60.0,
        max_day_hours: '14ч 10м',
        min_day_hours: '10ч 20м',
      },
    ],
    moons: [
      {
        name: 'Луна (Селена)',
        orbital_period: 29.53,
        start_phase: 0.5,
        color: 'var(--color-moon-primary, var(--color-surface-hover))',
      },
    ],
  };
}

export function populatePlanetFromEntity(dto: PlanetDto, found: PlanetEntity): void {
  dto.id = String(found.id);
  dto.name = found.name;
  dto.ticks_per_day = found.ticks_per_day || 86400;
  dto.day_hours = Math.floor(dto.ticks_per_day / 3600);
  dto.day_minutes = Math.floor((dto.ticks_per_day % 3600) / 60);
  dto.day_seconds = dto.ticks_per_day % 60;
  dto.orbit_days = found.orbit_days || 365.2422;
  dto.axial_tilt_mdeg = Math.round((found.axial_tilt || 23.44) * 1000);
  dto.rotation_direction = found.is_retrograde ? 'retrograde' : 'direct';
  if (found.timezones && found.timezones.length > 0) {
    dto.timezones = found.timezones.map((tz) => ({
      name: tz.name,
      code: tz.code || 'UTC+0',
      offset_hours: tz.base_offset_hours ?? (tz as unknown as { offset_hours?: number }).offset_hours ?? 0,
      dst_rule: (((tz as unknown as { dst_rule?: string }).dst_rule as 'none' | 'eu' | 'us') || 'none'),
    }));
  }
  if (found.regions && found.regions.length > 0) {
    dto.regions = found.regions.map((r) => ({
      name: r.name,
      timezone_code: r.timezone_id || (r as unknown as { timezone_code?: string }).timezone_code || 'UTC+0',
      latitude: r.latitude || 0,
      longitude: r.longitude || 0,
      max_day_hours: r.summer_day_hours !== undefined ? `${r.summer_day_hours}ч` : ((r as unknown as { max_day_hours?: string }).max_day_hours || '12ч'),
      min_day_hours: r.winter_day_hours !== undefined ? `${r.winter_day_hours}ч` : ((r as unknown as { min_day_hours?: string }).min_day_hours || '12ч'),
    }));
  }
  if (found.moons && found.moons.length > 0) {
    dto.moons = found.moons.map((m) => ({
      name: m.name,
      orbital_period: m.period_days || 28,
      start_phase: m.initial_phase || 0,
      color: 'var(--color-moon-primary, var(--color-surface-hover))',
    }));
  }
}

export function calculateSolstices(orbitDays: number): PlanetSolstices {
  return {
    spring: Number((orbitDays * 0.219).toFixed(1)),
    summer: Number((orbitDays * 0.471).toFixed(1)),
    autumn: Number((orbitDays * 0.728).toFixed(1)),
    winter: Number((orbitDays * 0.972).toFixed(1)),
  };
}

const EARTH_TZ_NAMES: Record<number, { name: string; dst: 'none' | 'eu' | 'us' }> = {
  0: { name: 'Гринвич (UTC+0)', dst: 'eu' },
  1: { name: 'Центральная Европа (UTC+1)', dst: 'eu' },
  2: { name: 'Восточная Европа (UTC+2)', dst: 'eu' },
  3: { name: 'Москва (UTC+3)', dst: 'none' },
  4: { name: 'Самара, Баку (UTC+4)', dst: 'none' },
  5: { name: 'Екатеринбург (UTC+5)', dst: 'none' },
  6: { name: 'Омск, Астана (UTC+6)', dst: 'none' },
  7: { name: 'Красноярск, Бангкок (UTC+7)', dst: 'none' },
  8: { name: 'Иркутск, Пекин (UTC+8)', dst: 'none' },
  9: { name: 'Якутск, Токио (UTC+9)', dst: 'none' },
  10: { name: 'Владивосток, Сидней (UTC+10)', dst: 'none' },
  11: { name: 'Магадан (UTC+11)', dst: 'none' },
  12: { name: 'Камчатка, Фиджи (UTC+12)', dst: 'none' },
  [-5]: { name: 'Восточное побережье США (UTC-5)', dst: 'us' },
  [-6]: { name: 'Центральное время США (UTC-6)', dst: 'us' },
  [-7]: { name: 'Горное время США (UTC-7)', dst: 'us' },
  [-8]: { name: 'Тихоокеанское побережье США (UTC-8)', dst: 'us' },
};

export function buildEarth24Timezones(): PlanetTimezone[] {
  const list: PlanetTimezone[] = [];
  for (let h = -12; h <= 12; h++) {
    const sign = h >= 0 ? '+' : '';
    const info = EARTH_TZ_NAMES[h];
    list.push({
      name: info ? info.name : `Пояс ${sign}${h}`,
      code: `UTC${sign}${h}`,
      offset_hours: h,
      dst_rule: info ? info.dst : 'none',
    });
  }
  return list;
}

export function buildEarthRegions(): PlanetRegion[] {
  return [
    { name: 'Москва', timezone_code: 'UTC+3', latitude: 55.75, longitude: 37.61, max_day_hours: '17ч 34м', min_day_hours: '7ч 12м' },
    { name: 'Лондон (Гринвич)', timezone_code: 'UTC+0', latitude: 51.5, longitude: -0.12, max_day_hours: '16ч 38м', min_day_hours: '7ч 50м' },
    { name: 'Токио', timezone_code: 'UTC+9', latitude: 35.68, longitude: 139.69, max_day_hours: '14ч 35м', min_day_hours: '9ч 45м' },
    { name: 'Нью-Йорк', timezone_code: 'UTC-5', latitude: 40.71, longitude: -74.0, max_day_hours: '15ч 05м', min_day_hours: '9ч 15м' },
    { name: 'Сидней', timezone_code: 'UTC+10', latitude: -33.86, longitude: 151.2, max_day_hours: '14ч 24м', min_day_hours: '9ч 54м' },
  ];
}

export function buildFantasyRegions(): PlanetRegion[] {
  return [
    { name: 'Столица Империи', timezone_code: 'UTC+0', latitude: 50.0, longitude: 0.0, max_day_hours: '16ч 00м', min_day_hours: '8ч 00м' },
    { name: 'Южная Гавань', timezone_code: 'UTC+3', latitude: 30.0, longitude: 45.0, max_day_hours: '14ч 00м', min_day_hours: '10ч 00м' },
    { name: 'Северные Пределы', timezone_code: 'UTC-2', latitude: 65.0, longitude: -30.0, max_day_hours: '20ч 00м', min_day_hours: '4ч 00м' },
  ];
}
