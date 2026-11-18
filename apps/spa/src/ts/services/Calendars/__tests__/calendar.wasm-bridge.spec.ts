import { describe, it, expect } from 'vitest';
import {
  CalendarWasmBridge,
  getWasmEngine,
  isWasmReady
} from '../calendar.wasm-bridge';
import type { DialHierarchy } from '@worldwiki/calendar-wasm';

describe('calendar.wasm-bridge', () => {
  it('initializes WASM engine in Node and converts moments and dial ticks', () => {
    const engine = getWasmEngine();
    expect(engine).not.toBeNull();
    expect(isWasmReady()).toBe(true);
    expect(CalendarWasmBridge.getEngine()).toBeDefined();

    const moment = CalendarWasmBridge.tAbsToLocalMoment(1000n, 'earth', 86400, 0);
    expect(moment.planet_id).toBe('earth');
    const back = CalendarWasmBridge.localMomentToTAbs(moment, 86400, 0);
    expect(back).toBe(1000n);

    const hierarchy = {
      units: [
        { name: 'Час', subdivisions: 24 },
        { name: 'Минута', subdivisions: 60 },
        { name: 'Секунда', subdivisions: 60 }
      ]
    } as unknown as DialHierarchy;
    const tick = CalendarWasmBridge.unitsToDayTick([1, 2, 3], hierarchy, 86400);
    expect(tick).toBe(3723);
    expect(CalendarWasmBridge.dayTickToUnits(tick, hierarchy, 86400)).toEqual([1, 2, 3]);
  });

  it('covers drift, harmonics validation, weekdays, cultural months, holidays, solstices, and double full moon', () => {
    const harmonics = [
      { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
      { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
      { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 }
    ];
    const drift = CalendarWasmBridge.calculateDriftPerCentury(365, harmonics, 365.2422);
    expect(typeof drift).toBe('number');

    const valid = CalendarWasmBridge.validateHarmonics([{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }]);
    expect(valid.is_valid).toBe(true);

    expect(CalendarWasmBridge.calculateWeekday(0, 0, 0, 7)).toBe(0);
    expect(
      CalendarWasmBridge.calculateWeekdayWithPause(1, 10, {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 1,
        harmonics: [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }],
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 7
      })
    ).toBeDefined();

    expect(CalendarWasmBridge.toCulturalMonth(2, 1, 12)).toBe(3);
    expect(CalendarWasmBridge.toInternalMonth(3, 1, 12)).toBe(2);

    expect(CalendarWasmBridge.isHolidayActive(0, 1, 0, 1, 0, 1)).toBe(true);
    expect(
      CalendarWasmBridge.isHolidayActive(0, 1, {
        name: 'Праздник',
        start_month: 0,
        start_day: 1,
        end_month: 0,
        end_day: 2,
        duration_years: 1
      } as never)
    ).toBe(true);
    expect(
      CalendarWasmBridge.isMultiYearHolidayActive(2024, 0, 1, {
        name: 'Праздник',
        start_month: 0,
        start_day: 1,
        end_month: 0,
        end_day: 2,
        start_year: 2024,
        duration_years: 1
      } as never)
    ).toBeDefined();

    expect(CalendarWasmBridge.calculateLeapConvergents(2422, 10000, 1000).length).toBeGreaterThan(0);
    expect(CalendarWasmBridge.decomposeFractionToUnitHarmonics(1, 4, 2).length).toBeGreaterThan(0);

    expect(typeof CalendarWasmBridge.isSeasonConflictingWithSolstice([5, 6], true, 11, 12)).toBe('boolean');
    expect(
      typeof CalendarWasmBridge.isSeasonConflictingWithSolsticeHemisphere([5, 6], true, 11, 12, 'Northern')
    ).toBe('boolean');

    const doubleFull = CalendarWasmBridge.findNextDoubleFullMoon(
      { name: 'M1', period_days: 28, initial_phase: 0 },
      { name: 'M2', period_days: 14, initial_phase: 0 },
      1440,
      0,
      200
    );
    expect(doubleFull === null || typeof doubleFull === 'number').toBe(true);

    const phasesA = CalendarWasmBridge.calculateAllMoonPhases(
      [{ name: 'M1', period_days: 28, initial_phase: 0 }],
      1440,
      1440
    );
    expect(Array.isArray(phasesA)).toBe(true);

    const phasesB = CalendarWasmBridge.calculateAllMoonPhases(1440, 1440, [
      { name: 'M1', period_days: 28, initial_phase: 0 }
    ]);
    expect(Array.isArray(phasesB)).toBe(true);

    expect(
      CalendarWasmBridge.calculateAge({
        birth_year: 2000,
        birth_month: 0,
        birth_day: 1,
        current_year: 2024,
        current_month: 5,
        current_day: 10,
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
        max_days_in_birth_month: 31
      })
    ).toBe(24);

    const cultureConfig = {
      planet_id: 'earth',
      ticks_per_day: 86400,
      day_start_offset: 0,
      base_year_days: 365,
      regular_months: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      harmonics,
      leap_target: { InMonth: { target_month: 1 } },
      leap_day_offset: 0,
      calendar_origin_day: 0,
      dial: {
        units: [
          { name: 'Час', subdivisions: 24 },
          { name: 'Минута', subdivisions: 60 },
          { name: 'Секунда', subdivisions: 60 }
        ]
      },
      eras: [
        {
          name: 'НЭ',
          start_year: 1,
          start_month: 0,
          start_day: 1,
          end_year: null,
          end_month: null,
          end_day: null,
          is_count_down: false,
          counting_mode: 'by_calendar_year' as const,
          priority: 1
        }
      ]
    };

    const preview = CalendarWasmBridge.generateYearPreview(2024, cultureConfig, 0);
    expect(preview.year).toBe(2024);

    const audit1 = CalendarWasmBridge.auditCalendarCulture(cultureConfig, 365.2422);
    expect(typeof audit1.is_valid).toBe('boolean');
    const audit2 = CalendarWasmBridge.auditCalendarCulture(cultureConfig, 3652422, 10000);
    expect(typeof audit2.is_valid).toBe('boolean');

    const coord = { era_index: 0, year: 2024, month: 0, day: 1, unit_values: [0, 0, 0] };
    const tAbs = CalendarWasmBridge.dateToTAbs(coord, cultureConfig);
    expect(typeof tAbs).toBe('bigint');
    const backCoord = CalendarWasmBridge.tAbsToDate(tAbs, cultureConfig);
    expect(backCoord.year).toBe(2024);

    const linkedDay = CalendarWasmBridge.calculateLinkedAnchorWorldDay(
      coord,
      cultureConfig,
      coord,
      cultureConfig
    );
    expect(typeof linkedDay).toBe('number');

    const grid = CalendarWasmBridge.getMonthGridBundle({
      year: 2024,
      month: 0,
      config: cultureConfig
    });
    expect(grid.days.length).toBeGreaterThan(0);

    expect(CalendarWasmBridge.intervalsOverlap(0, 10, 5, 15)).toBe(true);
    expect(CalendarWasmBridge.intervalsOverlap(0, 5, 10, 15)).toBe(false);
    expect(CalendarWasmBridge.checkBilocation(0, 10, 'loc1', 5, 15, 'loc2')).toBe(true);
    expect(CalendarWasmBridge.checkDeathViolation(0, 20, 10)).toBe(true);
  });
});
