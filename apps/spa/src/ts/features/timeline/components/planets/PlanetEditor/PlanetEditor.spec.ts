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
    getPlanets: vi.fn().mockReturnValue([]),
    savePlanet: vi.fn(),
    savePlanetToStorage: vi.fn(),
    deletePlanetFromStorage: vi.fn(),
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

  it('covers timezones, region presets, decimalAxialTilt, updateName, savePlanet, deletePlanet, applyPreset, and populatePlanetFromEntity', async () => {
    const { defineComponent, h } = await import('vue');
    const { mount, flushPromises } = await import('@vue/test-utils');
    const { calendarApi } = await import('@/services/api/calendar.api');
    const { PLANET_PRESETS } = await import('./presets/planet.presets');
    const { populatePlanetFromEntity } = await import('./planetEditor.utils');

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);

    let editor!: ReturnType<typeof usePlanetEditor>;
    const Comp = defineComponent({
      setup() {
        editor = usePlanetEditor(props, emit);
        return () => h('div');
      }
    });

    const wrapper = mount(Comp);
    await flushPromises();

    // Timezones & region presets
    editor.addTimezone({ name: 'Восток', code: 'UTC+5', offset_hours: 5 });
    expect(editor.planet.value.timezones.some((t) => t.code === 'UTC+5')).toBe(true);
    editor.removeTimezone(editor.planet.value.timezones.length - 1);
    editor.applyTimezonePreset('single');
    expect(editor.planet.value.timezones).toHaveLength(1);
    expect(editor.planet.value.regions[0].timezone_code).toBe('UTC+0');

    editor.applyRegionsPreset('earth');
    expect(editor.planet.value.regions.length).toBeGreaterThan(3);
    editor.applyRegionsPreset('fantasy');
    expect(editor.planet.value.regions).toHaveLength(3);

    // decimalAxialTilt & updateName
    editor.decimalAxialTilt.value = 15.5;
    expect(editor.decimalAxialTilt.value).toBe(15.5);
    expect(editor.planet.value.axial_tilt_mdeg).toBe(15500);

    editor.updateName('Новая Земля');
    expect(editor.planet.value.name).toBe('Новая Земля');

    // Preset modal & applyPreset
    editor.openPresetsModal();
    expect(editor.isPresetsModalOpen.value).toBe(true);
    if (PLANET_PRESETS.length > 0) {
      editor.applyPreset(PLANET_PRESETS[0]);
      expect(editor.planet.value.name).toBeTruthy();
    }

    // savePlanet success & error
    await editor.savePlanet();
    expect(calendarApi.savePlanetDirect).toHaveBeenCalled();

    vi.mocked(calendarApi.savePlanetDirect).mockRejectedValueOnce(new Error('save planet fail'));
    await editor.savePlanet();
    expect(editor.errorMessage.value).toContain('Ошибка сохранения планеты');

    // deletePlanet cancel, success, error
    confirmMock.mockReturnValueOnce(false);
    await editor.deletePlanet();
    expect(calendarApi.deletePlanetDirect).not.toHaveBeenCalled();

    confirmMock.mockReturnValueOnce(true);
    await editor.deletePlanet();
    expect(calendarApi.deletePlanetDirect).toHaveBeenCalledWith('test_proj', 'earth_id');

    confirmMock.mockReturnValueOnce(true);
    vi.mocked(calendarApi.deletePlanetDirect).mockRejectedValueOnce(new Error('del planet fail'));
    await editor.deletePlanet();
    expect(editor.errorMessage.value).toContain('Ошибка удаления планеты');

    // populatePlanetFromEntity with retrograde + moons + timezones + regions
    populatePlanetFromEntity(editor.planet.value, {
      id: 'pl:1',
      project_id: 'test_proj',
      name: 'Марс',
      ticks_per_day: 88642,
      orbit_days: 687,
      axial_tilt: 25.19,
      is_retrograde: true,
      timezones: [{ id: 'tz0', name: 'T0', code: 'M0', base_offset_hours: 0 }],
      regions: [{ id: 'r0', name: 'Олимп', timezone_id: 'M0', latitude: 18, longitude: 133, summer_day_hours: 13, winter_day_hours: 11 }],
      moons: [{ name: 'Фобос', period_days: 0.3, period_days_num: 30, period_days_den: 100, initial_phase: 0.2, initial_phase_bp: 2000 }]
    });
    expect(editor.planet.value.rotation_direction).toBe('retrograde');
    expect(editor.planet.value.moons[0].name).toBe('Фобос');

    // Events
    document.dispatchEvent(new CustomEvent('ww:planet-renamed', { detail: { id: 'earth_id', name: 'Терра' } }));
    expect(editor.planet.value.name).toBe('Терра');
    document.dispatchEvent(new CustomEvent('ww:planet-renamed', { detail: { id: 'earth_id', name: 'Терра' } }));
    document.dispatchEvent(new CustomEvent('ww:trigger-planet-save', { detail: { id: 'earth_id' } }));
    document.dispatchEvent(new CustomEvent('ww:trigger-planet-save', { detail: {} }));
    await flushPromises();

    // openPresetsModal, applyPreset, updateDayTicks NaN, non-Error rejections, deletePlanet without id
    editor.openPresetsModal();
    expect(editor.isPresetsModalOpen.value).toBe(true);
    editor.applyPreset({
      id: 'custom_p',
      data: {
        name: 'Кастом',
        description: 'desc',
        orbit_days: 400,
        day_hours: 20,
        day_minutes: 0,
        day_seconds: 0,
        axial_tilt_deg: 15,
        rotation_direction: 'prograde',
        moons: [],
      },
    } as any);
    expect(editor.planet.value.name).toBe('Кастом');

    editor.planet.value.day_hours = undefined as any;
    editor.planet.value.day_minutes = undefined as any;
    editor.planet.value.day_seconds = undefined as any;
    editor.updateDayTicks();
    expect(editor.planet.value.ticks_per_day).toBe(0);

    vi.mocked(calendarApi.savePlanetDirect).mockRejectedValueOnce('str save err');
    await editor.savePlanet();
    expect(editor.errorMessage.value).toContain('str save err');

    confirmMock.mockReturnValueOnce(true);
    vi.mocked(calendarApi.deletePlanetDirect).mockRejectedValueOnce('str del err');
    await editor.deletePlanet();
    expect(editor.errorMessage.value).toContain('str del err');

    editor.planet.value.id = null;
    await editor.deletePlanet();

    vi.unstubAllGlobals();
    errSpy.mockRestore();
    wrapper.unmount();
  });

  it('loads planet when not found in store using non-earth planetId', async () => {
    const { defineComponent } = await import('vue');
    const { mount } = await import('@vue/test-utils');
    let editor!: ReturnType<typeof usePlanetEditor>;
    const Comp = defineComponent({
      setup() {
        editor = usePlanetEditor({ projectId: 'p_missing', planetId: 'Arrakis' }, vi.fn());
        return {};
      },
      template: '<div></div>',
    });
    const w = mount(Comp);
    expect(editor.planet.value.id).toBe('Arrakis');
    expect(editor.planet.value.name).toBe('Arrakis');
    w.unmount();
  });
});
