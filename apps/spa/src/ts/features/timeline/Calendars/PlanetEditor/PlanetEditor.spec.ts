import { describe, it, expect, vi } from 'vitest';
import { usePlanetEditor } from './usePlanetEditor';
import type { PlanetEntity } from './PlanetEditor.model';

describe('usePlanetEditor', () => {
  const initialPlanet: PlanetEntity = {
    id: 'mars',
    project_id: 'test_project',
    name: 'Марс',
    ticks_per_day: 88775,
    orbit_days: 668.59,
    axial_tilt: 25.19,
    is_retrograde: false,
    solstice_world_day: 355,
    moons: [{ name: 'Фобос', period_days: 0.32 }],
    timezones: [{ id: 'tz_utc', name: 'Меридиан', code: 'UTC', base_offset_hours: 0 }],
    regions: [{ id: 'reg_1', name: 'Экваториальная равнина', timezone_id: 'tz_utc', latitude: 0, longitude: 0, summer_day_hours: 12, winter_day_hours: 12 }],
  };

  it('initializes with provided planet data', () => {
    const emit = vi.fn();
    const { localPlanet } = usePlanetEditor({ planet: initialPlanet }, emit);

    expect(localPlanet.id).toBe('mars');
    expect(localPlanet.name).toBe('Марс');
    expect(localPlanet.ticks_per_day).toBe(88775);
    expect(localPlanet.moons?.length).toBe(1);
    expect(localPlanet.timezones?.length).toBe(1);
    expect(localPlanet.regions?.length).toBe(1);
  });

  it('correctly calculates 4 astronomical points of the year', () => {
    const emit = vi.fn();
    const { astronomicalPoints } = usePlanetEditor({ planet: initialPlanet }, emit);

    expect(astronomicalPoints.value.winterSolstice).toBe(355);
    const orbit = 668.59;
    expect(astronomicalPoints.value.springEquinox).toBe(Math.round((355 + orbit * 0.25) % orbit));
    expect(astronomicalPoints.value.summerSolstice).toBe(Math.round((355 + orbit * 0.5) % orbit));
    expect(astronomicalPoints.value.autumnEquinox).toBe(Math.round((355 + orbit * 0.75) % orbit));
  });

  it('calculates solstice day from cultural calendar date', () => {
    const emit = vi.fn();
    const earthCalendar = {
      data: {
        название: 'Григорианский',
        дней_в_неделе: 7,
        названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        первый_месяц_года: 0,
        месяцы: [
          { название: 'Январь', дней: 31 },
          { название: 'Февраль', дней: 28 },
          { название: 'Март', дней: 31 },
          { название: 'Апрель', дней: 30 },
          { название: 'Май', дней: 31 },
          { название: 'Июнь', дней: 30 },
          { название: 'Июль', дней: 31 },
          { название: 'Август', дней: 31 },
          { название: 'Сентябрь', дней: 30 },
          { название: 'Октябрь', дней: 31 },
          { название: 'Ноябрь', дней: 30 },
          { название: 'Декабрь', дней: 31 },
        ],
        эпохи: [],
      },
    };

    const {
      localPlanet,
      calcMonthIdx,
      calcDay,
      applySolsticeFromCalendar,
      solsticeHumanExplanation,
    } = usePlanetEditor(
      { planet: initialPlanet, calendars: [earthCalendar] },
      emit
    );

    calcMonthIdx.value = 11;
    calcDay.value = 21;
    applySolsticeFromCalendar();

    expect(localPlanet.solstice_world_day).toBe(355);
    expect(solsticeHumanExplanation.value).toContain('21 Декабрь');
    expect(emit).toHaveBeenCalledWith('update:planet', expect.objectContaining({ solstice_world_day: 355 }));
  });

  it('adds and removes timezones properly', () => {
    const emit = vi.fn();
    const { localPlanet, addTimezone, removeTimezone } = usePlanetEditor({ planet: initialPlanet }, emit);

    addTimezone();
    expect(localPlanet.timezones?.length).toBe(2);
    expect(emit).toHaveBeenCalledWith('update:planet', expect.any(Object));

    removeTimezone(1);
    expect(localPlanet.timezones?.length).toBe(1);
  });

  it('adds and removes regions properly', () => {
    const emit = vi.fn();
    const { localPlanet, addRegion, removeRegion } = usePlanetEditor({ planet: initialPlanet }, emit);

    addRegion();
    expect(localPlanet.regions?.length).toBe(2);
    expect(emit).toHaveBeenCalledWith('update:planet', expect.any(Object));

    removeRegion(1);
    expect(localPlanet.regions?.length).toBe(1);
  });

  it('calculates daylight hours for equator and polar latitudes', () => {
    const emit = vi.fn();
    const { localPlanet, calculateDaylightForRegion } = usePlanetEditor({ planet: initialPlanet }, emit);

    // Equator (latitude = 0)
    const eqRegion = localPlanet.regions![0];
    calculateDaylightForRegion(eqRegion);
    const totalHours = 88775 / 3600; // ~24.66
    expect(eqRegion.summer_day_hours).toBeCloseTo(totalHours / 2, 1);
    expect(eqRegion.winter_day_hours).toBeCloseTo(totalHours / 2, 1);

    // Polar region (latitude = 85, axial tilt = 25.19 -> polar day summer, polar night winter)
    eqRegion.latitude = 85;
    calculateDaylightForRegion(eqRegion);
    expect(eqRegion.summer_day_hours).toBeCloseTo(totalHours, 1);
    expect(eqRegion.winter_day_hours).toBe(0);
  });

  it('updates daylight hours and minutes via setters', () => {
    const emit = vi.fn();
    const { localPlanet, setSummerHours, setSummerMinutes, getSummerHours, getSummerMinutes } = usePlanetEditor({ planet: initialPlanet }, emit);

    const reg = localPlanet.regions![0];
    setSummerHours(reg, 15);
    setSummerMinutes(reg, 30);

    expect(getSummerHours(reg)).toBe(15);
    expect(getSummerMinutes(reg)).toBe(30);
    expect(reg.summer_day_hours).toBe(15.5);
  });

  it('adds a new moon correctly and emits change', () => {
    const emit = vi.fn();
    const { localPlanet, addMoon } = usePlanetEditor({ planet: initialPlanet }, emit);

    addMoon();
    expect(localPlanet.moons?.length).toBe(2);
    expect(localPlanet.moons?.[1].name).toBe('Спутник 2');
    expect(emit).toHaveBeenCalledWith('update:planet', expect.objectContaining({ name: 'Марс' }));
  });

  it('removes a moon correctly', () => {
    const emit = vi.fn();
    const { localPlanet, removeMoon } = usePlanetEditor({ planet: initialPlanet }, emit);

    removeMoon(0);
    expect(localPlanet.moons?.length).toBe(0);
    expect(emit).toHaveBeenCalledWith('update:planet', expect.any(Object));
  });

  it('emits save and delete events properly', () => {
    const emit = vi.fn();
    const { save, remove } = usePlanetEditor({ planet: initialPlanet }, emit);

    save();
    expect(emit).toHaveBeenCalledWith('save', expect.objectContaining({ id: 'mars' }));

    remove();
    expect(emit).toHaveBeenCalledWith('delete', 'mars');
  });

  it('updates ticks_per_day when day hours, minutes and seconds change', () => {
    const emit = vi.fn();
    const { localPlanet, dayHours, dayMinutes, daySeconds, onDayTimeChange } = usePlanetEditor(
      { planet: initialPlanet },
      emit
    );

    dayHours.value = 24;
    dayMinutes.value = 39;
    daySeconds.value = 35;
    onDayTimeChange();

    expect(localPlanet.ticks_per_day).toBe(24 * 3600 + 39 * 60 + 35);
    expect(emit).toHaveBeenCalledWith('update:planet', expect.objectContaining({ ticks_per_day: 88775 }));
  });
});
