/**
 * @file planetEditor.utils.ts
 * @description Вспомогательные функции, мапперы и пресеты для редактора планеты.
 */

import type {
  PlanetDto,
  PlanetSolstices,
  PlanetTimezone,
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
      offset_hours: tz.base_offset_hours ?? 0,
      dst_rule: 'none',
    }));
  }
  if (found.regions && found.regions.length > 0) {
    dto.regions = found.regions.map((r) => ({
      name: r.name,
      timezone_code: r.timezone_id || 'UTC+0',
      latitude: r.latitude || 0,
      longitude: r.longitude || 0,
      max_day_hours: `${r.summer_day_hours || 12}ч`,
      min_day_hours: `${r.winter_day_hours || 12}ч`,
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

export function buildEarth24Timezones(): PlanetTimezone[] {
  const list: PlanetTimezone[] = [];
  for (let h = -12; h <= 12; h++) {
    const sign = h >= 0 ? '+' : '';
    list.push({
      name: h === 0 ? 'Гринвич / Меридиан' : `Пояс ${sign}${h}`,
      code: `UTC${sign}${h}`,
      offset_hours: h,
      dst_rule: 'none',
    });
  }
  return list;
}
