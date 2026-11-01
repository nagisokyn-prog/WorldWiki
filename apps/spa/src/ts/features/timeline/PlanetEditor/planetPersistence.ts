/**
 * @file planetPersistence.ts
 * @description Слой сохранения, удаления и применения пресетов для PlanetEditor.
 */

import { calendarApi } from '@/services/api/calendar.api';
import type { useCalendarStore } from '@/stores/calendar.store';
import type {
  PlanetDto,
  PlanetTimezone,
  PlanetRegion,
  PlanetMoon,
} from './PlanetEditor.model';
import type { PlanetPreset } from './presets/planet.presets';
import {
  toPlanetEntity,
  buildEarth24Timezones,
  buildEarthRegions,
  buildFantasyRegions,
} from './planetEditor.utils';

export function addPlanetTimezone(planet: PlanetDto, tz?: Partial<PlanetTimezone>): void {
  planet.timezones.push({
    name: tz?.name || `Пояс ${planet.timezones.length + 1}`,
    code: tz?.code || `UTC+${planet.timezones.length}`,
    offset_hours: tz?.offset_hours ?? 0,
    dst_rule: tz?.dst_rule || 'none',
  });
}

export function removePlanetTimezone(planet: PlanetDto, index: number): void {
  if (index >= 0 && index < planet.timezones.length) {
    planet.timezones.splice(index, 1);
  }
}

export function applyPlanetTimezonePreset(planet: PlanetDto, preset: 'earth24' | 'single'): void {
  if (preset === 'single') {
    planet.timezones = [
      { name: 'Нулевой меридиан', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' },
    ];
    if (planet.regions && planet.regions.length > 0) {
      planet.regions.forEach((r) => {
        r.timezone_code = 'UTC+0';
      });
    }
  } else if (preset === 'earth24') {
    planet.timezones = buildEarth24Timezones();
  }
}

export function addPlanetRegion(planet: PlanetDto, reg?: Partial<PlanetRegion>): void {
  planet.regions.push({
    name: reg?.name || `Регион ${planet.regions.length + 1}`,
    timezone_code: reg?.timezone_code || 'UTC+0',
    latitude: reg?.latitude ?? 0,
    longitude: reg?.longitude ?? 0,
    max_day_hours: reg?.max_day_hours || '12ч 00м',
    min_day_hours: reg?.min_day_hours || '12ч 00м',
  });
}

export function removePlanetRegion(planet: PlanetDto, index: number): void {
  if (index >= 0 && index < planet.regions.length) {
    planet.regions.splice(index, 1);
  }
}

export function applyPlanetRegionsPreset(planet: PlanetDto, preset: 'earth' | 'fantasy'): void {
  if (preset === 'earth') {
    planet.regions = buildEarthRegions();
  } else if (preset === 'fantasy') {
    planet.regions = buildFantasyRegions();
  }
}

export function addPlanetMoon(planet: PlanetDto, moon?: Partial<PlanetMoon>): void {
  planet.moons.push({
    name: moon?.name || `Луна ${planet.moons.length + 1}`,
    orbital_period: moon?.orbital_period ?? 28.0,
    start_phase: moon?.start_phase ?? 0.0,
    color: moon?.color || 'var(--color-moon-secondary, var(--color-border-subtle))',
  });
}

export function removePlanetMoon(planet: PlanetDto, index: number): void {
  if (index >= 0 && index < planet.moons.length) {
    planet.moons.splice(index, 1);
  }
}

export async function persistPlanetSave(
  planet: PlanetDto,
  projectId: string,
  calendarStore: ReturnType<typeof useCalendarStore>
): Promise<void> {
  const payload: Record<string, unknown> = {
    name: planet.name,
    ticks_per_day: planet.ticks_per_day,
    axial_tilt_mdeg: planet.axial_tilt_mdeg,
    orbit_days_num: planet.orbit_days_num,
    orbit_days_den: planet.orbit_days_den,
    rotation_direction: planet.rotation_direction,
    moons: planet.moons.map((m) => {
      const clean: Record<string, unknown> = {
        name: m.name,
        orbital_period: m.orbital_period,
        start_phase: m.start_phase,
      };
      if (m.id) clean.id = m.id;
      return clean;
    }),
    timezones: planet.timezones,
    regions: planet.regions,
    solstices: planet.solstices,
  };

  calendarStore.savePlanetToStorage(projectId, toPlanetEntity(planet, projectId));
  await calendarApi.savePlanetDirect(
    projectId,
    planet.id || null,
    planet.name,
    payload
  );
}

export async function persistPlanetDelete(
  planetId: string,
  projectId: string,
  calendarStore: ReturnType<typeof useCalendarStore>
): Promise<void> {
  calendarStore.deletePlanetFromStorage(projectId, planetId);
  await calendarApi.deletePlanetDirect(projectId, planetId);
}

export function applyPlanetPresetData(
  planet: PlanetDto,
  preset: PlanetPreset,
  updateDayTicksFn: () => void
): void {
  const p = preset.data;
  if (p.name) planet.name = p.name;
  if (p.icon) planet.icon = p.icon;
  if (p.day_hours !== undefined) planet.day_hours = p.day_hours;
  if (p.day_minutes !== undefined) planet.day_minutes = p.day_minutes;
  if (p.day_seconds !== undefined) planet.day_seconds = p.day_seconds;
  if (p.ticks_per_day !== undefined) {
    planet.ticks_per_day = p.ticks_per_day;
  } else {
    updateDayTicksFn();
  }
  if (p.orbit_days !== undefined) planet.orbit_days = p.orbit_days;
  if (p.orbit_days_num !== undefined) planet.orbit_days_num = p.orbit_days_num;
  if (p.orbit_days_den !== undefined) planet.orbit_days_den = p.orbit_days_den;
  if (p.axial_tilt_mdeg !== undefined) planet.axial_tilt_mdeg = p.axial_tilt_mdeg;
  if (p.rotation_direction) planet.rotation_direction = p.rotation_direction;
  if (p.solstices) planet.solstices = { ...p.solstices };
  if (p.timezones) planet.timezones = JSON.parse(JSON.stringify(p.timezones));
  if (p.regions) planet.regions = JSON.parse(JSON.stringify(p.regions));
  if (p.moons) planet.moons = JSON.parse(JSON.stringify(p.moons));
}
