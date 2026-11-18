import { describe, it, expect } from 'vitest';
import { CalendarAstronomy } from './calendar.astronomy';
import { CalendarFormat } from './calendar.format';

describe('CalendarAstronomy', () => {
  it('calculates daylight with fallback anchor/settings and formats literary daylight', () => {
    const cal = CalendarFormat.getDefaultCalendar();
    expect(CalendarAstronomy.calculateDaylight(0, cal, () => 365)).toBeNull();
    expect(CalendarAstronomy.formatDaylightLiterary(null)).toBeNull();

    const seasonalCal = {
      ...cal,
      настройки_времени: { учитывать_сезонную_длительность_дня: true, часов_в_сутках: 0, минут_в_часе: 0 },
      day_length_anchor: undefined,
    } as any;
    const dl = CalendarAstronomy.calculateDaylight(100000, seasonalCal, () => 365);
    expect(dl).not.toBeNull();
    const lit = CalendarAstronomy.formatDaylightLiterary(dl);
    expect(lit?.duration).toContain('Световой день:');
  });

  it('calculates moon phases with fallback settings and period_days', () => {
    const phases = CalendarAstronomy.calculateMoonPhases(
      0,
      [{ name: 'Селена', period_days: 28, initial_phase: 0.5 } as any],
      { настройки_времени: undefined } as any
    );
    expect(phases).toHaveLength(1);
    expect(phases[0].name).toBe('Полнолуние');
  });

  it('computes region sun status across dawn, day, dusk, night, and explainDate with daylight & moons', () => {
    const cal = {
      ...CalendarFormat.getDefaultCalendar(),
      _id: 'cal_local',
      название: 'Местный',
      настройки_времени: undefined,
      moons: [{ name: 'Луна', period_days: 28, initial_phase: 0 }],
    } as any;
    const masterCal = { ...CalendarFormat.getDefaultCalendar(), _id: 'cal_master' } as any;

    const calcDaylight = () => ({ sunrise: '05:00', sunset: '19:00', zenith: '12:00', duration_hours: 14 });

    const dawn = CalendarAstronomy.calculateSunForRegion({ name: 'Восток' } as any, { day_index: 0, day_fraction: 5 / 24 }, cal, calcDaylight, 0);
    expect(dawn.phase).toBe('dawn');
    expect(dawn.note).toBe('Регион: Восток');

    const moscowWinter = CalendarAstronomy.calculateSunForRegion(
      { name: 'Москва', latitude: 55.75, longitude: 37.61, summer_day_hours: 17.57, winter_day_hours: 7.2 } as any,
      { day_index: 0, day_fraction: 3 / 24 },
      masterCal,
      () => null,
      3
    );
    expect(moscowWinter.daylight_text).toBe('Световой день ~7 ч.');
    expect(moscowWinter.phase).toBe('night');

    const sydneySummer = CalendarAstronomy.calculateSunForRegion(
      { name: 'Сидней', latitude: -33.86, longitude: 151.2, summer_day_hours: 14.4, winter_day_hours: 9.9 } as any,
      { day_index: 0, day_fraction: 3 / 24 },
      masterCal,
      () => null,
      10
    );
    expect(sydneySummer.daylight_text).toBe('Световой день ~14 ч.');
    expect(sydneySummer.phase).toBe('day');

    const dusk = CalendarAstronomy.calculateSunForRegion({ name: '' } as any, { day_index: 0, day_fraction: 0.75 }, cal, () => null, 0);
    expect(dusk.phase).toBe('dusk');
    expect(dusk.note).toBeUndefined();

    const explained = CalendarAstronomy.explainDate(
      { era_index: 0, year: undefined as any, month: undefined as any, day: undefined as any, hour: 0, minute: 0 },
      cal,
      [cal, masterCal, { ...cal, _id: 'cal_other', название: 'Другой' }],
      masterCal,
      {
        formatDate: (c) => c.название,
        localDateToMasterMinute: () => 1440,
        getDateFromAbsolute: () => ({ era_index: 0, year: 1, month: 0, day: 2, hour: 0, minute: 0 }),
        masterMinuteToLocalDate: () => ({ era_index: 0, year: 1, month: 0, day: 2, hour: 0, minute: 0 }),
        calculateDaylight: calcDaylight,
        getSeasonForDate: () => 'Лето',
        isHoliday: () => true,
      }
    );
    expect(explained.holidays).toEqual(['Праздничный день']);
    expect(explained.daylightText).toContain('14 ч.');
    expect(explained.snippet).toContain('Новолуние');
    expect(explained.crossDates).toHaveLength(1);
  });
});
