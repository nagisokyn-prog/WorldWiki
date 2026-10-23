/**
 * @file PlanetEditor.spec.ts
 * @description Unit-тесты логики хука usePlanetEditor
 */

import { describe, it, expect, vi } from 'vitest';
import { usePlanetEditor } from './usePlanetEditor';
import type { PlanetEditorProps, PlanetEditorEmits } from './PlanetEditor.model';

vi.mock('@/services/api/calendar.api', () => ({
  calendarApi: {
    savePlanetDirect: vi.fn().mockResolvedValue({ success: true }),
    deletePlanetDirect: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    loadCalendars: vi.fn().mockResolvedValue([]),
    getCalendars: vi.fn().mockResolvedValue([]),
    calendars: [],
  }),
}));

describe('usePlanetEditor', () => {
  const props: PlanetEditorProps = {
    planetId: 'earth_id',
    projectId: 'test_proj',
  };

  const emit: PlanetEditorEmits = vi.fn() as unknown as PlanetEditorEmits;

  it('инициализирует дефолтные значения физики и табы', () => {
    const editor = usePlanetEditor(props, emit);
    expect(editor.activeTab.value).toBe('astrophysics');
    expect(editor.planet.value.ticks_per_day).toBe(86400);
    expect(editor.planet.value.orbit_days).toBeCloseTo(365.2422, 3);
  });

  it('переключает табы', () => {
    const editor = usePlanetEditor(props, emit);
    editor.setTab('timezones');
    expect(editor.activeTab.value).toBe('timezones');
    editor.setTab('moons');
    expect(editor.activeTab.value).toBe('moons');
  });

  it('корректно пересчитывает тики суток', () => {
    const editor = usePlanetEditor(props, emit);
    editor.planet.value.day_hours = 30;
    editor.planet.value.day_minutes = 0;
    editor.planet.value.day_seconds = 0;
    editor.updateDayTicks();
    expect(editor.planet.value.ticks_per_day).toBe(30 * 3600);
  });

  it('пересчитывает орбиту и обновляет точки солнцестояний', () => {
    const editor = usePlanetEditor(props, emit);
    editor.updateOrbitDays(400);
    expect(editor.planet.value.orbit_days).toBe(400);
    expect(editor.planet.value.solstices.summer).toBeCloseTo(400 * 0.471, 1);
    expect(editor.planet.value.solstices.winter).toBeCloseTo(400 * 0.972, 1);
  });

  it('применяет пресет 24 часовых поясов', () => {
    const editor = usePlanetEditor(props, emit);
    editor.applyTimezonePreset('earth24');
    expect(editor.planet.value.timezones.length).toBe(25); // -12 .. +12
  });

  it('добавляет и удаляет спутники (луны)', () => {
    const editor = usePlanetEditor(props, emit);
    const initialCount = editor.planet.value.moons.length;
    editor.addMoon({ name: 'Фобос', orbital_period: 0.31 });
    expect(editor.planet.value.moons.length).toBe(initialCount + 1);

    editor.removeMoon(editor.planet.value.moons.length - 1);
    expect(editor.planet.value.moons.length).toBe(initialCount);
  });

  it('добавляет и удаляет географические регионы', () => {
    const editor = usePlanetEditor(props, emit);
    const initialCount = editor.planet.value.regions.length;
    editor.addRegion({ name: 'Новый город', latitude: 45.0, longitude: 10.0 });
    expect(editor.planet.value.regions.length).toBe(initialCount + 1);

    editor.removeRegion(editor.planet.value.regions.length - 1);
    expect(editor.planet.value.regions.length).toBe(initialCount);
  });
});
