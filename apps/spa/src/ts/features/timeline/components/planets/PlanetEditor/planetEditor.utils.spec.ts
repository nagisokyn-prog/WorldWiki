import { describe, it, expect } from 'vitest';
import {
  toPlanetEntity,
  createDefaultPlanetDto,
  populatePlanetFromEntity,
} from './planetEditor.utils';

describe('planetEditor.utils', () => {
  it('createDefaultPlanetDto handles null, earth, and custom planetId', () => {
    const defNull = createDefaultPlanetDto(null);
    expect(defNull.id).toBeNull();
    expect(defNull.name).toBe('Планета');

    const defEarth = createDefaultPlanetDto('earth');
    expect(defEarth.name).toBe('Планета');

    const defCustom = createDefaultPlanetDto('Марс');
    expect(defCustom.name).toBe('Марс');
  });

  it('toPlanetEntity handles missing id and invalid day hours strings', () => {
    const dto = createDefaultPlanetDto(null);
    dto.regions[0].max_day_hours = '';
    dto.regions[0].min_day_hours = 'abc';
    const entity = toPlanetEntity(dto, 'p1');
    expect(entity.id).toBe('earth');
    expect(entity.regions?.[0].summer_day_hours).toBe(12);
    expect(entity.regions?.[0].winter_day_hours).toBe(12);
  });

  it('populatePlanetFromEntity handles sparse/falsy fields and retrograde rotation', () => {
    const dto = createDefaultPlanetDto('earth');
    populatePlanetFromEntity(dto, {
      id: 'planets:p2',
      project_id: 'p1',
      name: 'Венера',
      ticks_per_day: 0,
      orbit_days: 0,
      axial_tilt: 0,
      is_retrograde: true,
      timezones: [{ name: 'T1', offset_hours: -2 } as any],
      regions: [{ name: 'R1', timezone_code: 'T1', max_day_hours: '15ч', min_day_hours: '9ч' } as any],
      moons: [{ name: 'M1', period_days: 0, initial_phase: 0 } as any],
    });
    expect(dto.ticks_per_day).toBe(86400);
    expect(dto.rotation_direction).toBe('retrograde');
    expect(dto.timezones[0].code).toBe('UTC+0');
    expect(dto.timezones[0].offset_hours).toBe(-2);
    expect(dto.regions[0].timezone_code).toBe('T1');
    expect(dto.regions[0].max_day_hours).toBe('15ч');
    expect(dto.moons[0].orbital_period).toBe(28);

    // Empty timezones/regions/moons + fallback offset_hours/max_day_hours
    const dto2 = createDefaultPlanetDto('earth');
    populatePlanetFromEntity(dto2, {
      id: 'planets:p3',
      project_id: 'p1',
      name: 'Пустая',
      ticks_per_day: 1000,
      orbit_days: 100,
      axial_tilt: 10,
      is_retrograde: false,
      timezones: [{ name: 'T2' } as any],
      regions: [{ name: 'R2', summer_day_hours: 14, winter_day_hours: 10 } as any],
      moons: [],
    });
    expect(dto2.timezones[0].offset_hours).toBe(0);
    expect(dto2.regions[0].timezone_code).toBe('UTC+0');
    expect(dto2.regions[0].max_day_hours).toBe('14ч');
    expect(dto2.regions[0].min_day_hours).toBe('10ч');

    // Completely empty arrays branch
    const dto3 = createDefaultPlanetDto('earth');
    populatePlanetFromEntity(dto3, {
      id: 'planets:p4',
      project_id: 'p1',
      name: 'Без массивов',
      ticks_per_day: 1000,
      orbit_days: 100,
      axial_tilt: 10,
      is_retrograde: false,
      timezones: [],
      regions: [],
    });
    expect(dto3.timezones.length).toBeGreaterThan(0);
  });
});
