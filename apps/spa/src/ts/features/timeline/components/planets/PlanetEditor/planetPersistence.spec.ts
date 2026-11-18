import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  addPlanetTimezone,
  removePlanetTimezone,
  applyPlanetTimezonePreset,
  addPlanetRegion,
  removePlanetRegion,
  applyPlanetRegionsPreset,
  addPlanetMoon,
  removePlanetMoon,
  persistPlanetSave,
  persistPlanetDelete,
  applyPlanetPresetData,
} from './planetPersistence';
import { calendarApi } from '@/services/api/calendar.api';

vi.mock('@/services/api/calendar.api', () => ({
  calendarApi: {
    savePlanetDirect: vi.fn(async () => ({})),
    deletePlanetDirect: vi.fn(async () => undefined),
  },
}));

describe('planetPersistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('adds, removes, and applies presets for timezones, regions, and moons', () => {
    const planet: any = {
      id: '',
      name: 'Терра',
      ticks_per_day: 86400,
      axial_tilt_mdeg: 23440,
      orbit_days: 365,
      orbit_days_num: 365,
      orbit_days_den: 1,
      rotation_direction: 'prograde',
      solstices: {},
      timezones: [],
      regions: [],
      moons: [],
    };

    addPlanetTimezone(planet);
    expect(planet.timezones).toHaveLength(1);
    expect(planet.timezones[0].name).toBe('Пояс 1');
    removePlanetTimezone(planet, 99);
    removePlanetTimezone(planet, 0);
    expect(planet.timezones).toHaveLength(0);

    addPlanetRegion(planet);
    expect(planet.regions[0].name).toBe('Регион 1');
    applyPlanetTimezonePreset(planet, 'single');
    expect(planet.regions[0].timezone_code).toBe('UTC+0');
    applyPlanetTimezonePreset(planet, 'earth24');
    expect(planet.timezones.length).toBeGreaterThan(1);

    removePlanetRegion(planet, 99);
    removePlanetRegion(planet, 0);
    expect(planet.regions).toHaveLength(0);

    applyPlanetRegionsPreset(planet, 'earth');
    expect(planet.regions.length).toBeGreaterThan(0);
    applyPlanetRegionsPreset(planet, 'fantasy');
    expect(planet.regions.length).toBeGreaterThan(0);

    addPlanetMoon(planet);
    expect(planet.moons[0].name).toBe('Луна 1');
    removePlanetMoon(planet, 99);
    removePlanetMoon(planet, 0);
    expect(planet.moons).toHaveLength(0);
  });

  it('persists save/delete and applies preset data', async () => {
    const calStore = {
      savePlanetToStorage: vi.fn(),
      deletePlanetFromStorage: vi.fn(),
    } as any;

    const planet: any = {
      id: '',
      name: 'Марс',
      ticks_per_day: 88775,
      axial_tilt_mdeg: 25190,
      orbit_days_num: 687,
      orbit_days_den: 1,
      rotation_direction: 'prograde',
      solstices: {},
      timezones: [],
      regions: [],
      moons: [{ id: 'm1', name: 'Фобос', orbital_period: 0.3, start_phase: 0 }],
    };

    await persistPlanetSave(planet, 'p1', calStore);
    expect(calStore.savePlanetToStorage).toHaveBeenCalled();
    expect(calendarApi.savePlanetDirect).toHaveBeenCalledWith('p1', null, 'Марс', expect.any(Object));

    await persistPlanetDelete('planets:1', 'p1', calStore);
    expect(calStore.deletePlanetFromStorage).toHaveBeenCalledWith('p1', 'planets:1');
    expect(calendarApi.deletePlanetDirect).toHaveBeenCalledWith('p1', 'planets:1');

    const updateTicks = vi.fn();
    applyPlanetPresetData(
      planet,
      {
        name: 'Preset',
        data: {
          name: 'Земля',
          icon: '🌍',
          day_hours: 24,
          day_minutes: 60,
          day_seconds: 60,
          orbit_days: 365.25,
          orbit_days_num: 1461,
          orbit_days_den: 4,
          axial_tilt_mdeg: 23440,
          rotation_direction: 'prograde',
          solstices: { summer: 172 },
          timezones: [{ name: 'UTC', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' }],
          regions: [{ name: 'R', timezone_code: 'UTC+0', latitude: 0, longitude: 0 }],
          moons: [{ name: 'Луна', orbital_period: 28, start_phase: 0 }],
        },
      } as any,
      updateTicks
    );
    expect(updateTicks).toHaveBeenCalled();
    expect(planet.name).toBe('Земля');

    applyPlanetPresetData(planet, { name: 'P2', data: { ticks_per_day: 1000 } } as any, updateTicks);
    expect(planet.ticks_per_day).toBe(1000);
  });
});
