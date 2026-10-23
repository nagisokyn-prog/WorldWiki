import { describe, it, expect } from 'vitest';
import { useCalendarEngine } from '../useCalendarEngine';
import type {
  DialHierarchy,
  LeapHarmonic,
  MoonConfig,
  WasmCultureConfig,
  WasmWeekdayPauseParams,
} from '@worldwiki/calendar-wasm';

describe('useCalendarEngine', () => {
  const engine = useCalendarEngine();

  describe('Galactic t_abs <-> LocalMoment bijection', () => {
    it('converts t_abs 0 to day 0, tick 0', () => {
      const moment = engine.tAbsToLocalMoment(0, 'earth', 86400, 0);
      expect(moment).toEqual({
        planet_id: 'earth',
        world_day: 0,
        day_tick: 0,
      });

      const tAbs = engine.localMomentToTAbs(moment, 86400, 0);
      expect(tAbs).toBe(0n);
    });

    it('handles negative t_abs cleanly with Euclidean division', () => {
      const moment = engine.tAbsToLocalMoment(-100, 'earth', 86400, 0);
      expect(moment.world_day).toBe(-1);
      expect(moment.day_tick).toBe(86300);

      const tAbs = engine.localMomentToTAbs(moment, 86400, 0);
      expect(tAbs).toBe(-100n);
    });

    it('preserves bijection with day_start_offset', () => {
      const offset = 21600; // 6 hours
      const moment = engine.tAbsToLocalMoment(100000, 'mars', 88642, offset);
      const restored = engine.localMomentToTAbs(moment, 88642, offset);
      expect(restored).toBe(100000n);
    });
  });

  describe('DialHierarchy arbitrary day division', () => {
    it('quantizes standard 24h / 60m dial reversibly', () => {
      const hierarchy: DialHierarchy = {
        units: [
          { name: 'Hour', subdivisions: 24 },
          { name: 'Minute', subdivisions: 60 },
        ],
      };
      const ticksPerDay = 86400;

      const unitValues = [12, 30]; // 12:30
      const tick = engine.unitsToDayTick(unitValues, hierarchy, ticksPerDay);
      expect(tick).toBe(45000); // 12.5 * 3600

      const restored = engine.dayTickToUnits(tick, hierarchy, ticksPerDay);
      expect(restored).toEqual(unitValues);
    });

    it('quantizes fantasy 10 watches / 50 bells dial without drift', () => {
      const hierarchy: DialHierarchy = {
        units: [
          { name: 'Watch', subdivisions: 10 },
          { name: 'Bell', subdivisions: 50 },
        ],
      };
      const ticksPerDay = 50000;

      const unitValues = [7, 42];
      const tick = engine.unitsToDayTick(unitValues, hierarchy, ticksPerDay);
      const restored = engine.dayTickToUnits(tick, hierarchy, ticksPerDay);
      expect(restored).toEqual(unitValues);
    });
  });

  describe('Drift and Harmonic Validation', () => {
    it('calculates Gregorian century drift accurately (~0.031 days)', () => {
      const gregorianHarmonics: LeapHarmonic[] = [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ];
      const drift = engine.calculateDriftPerCentury(365, gregorianHarmonics, 365.24219);
      expect(drift).toBeCloseTo(0.031, 2);
    });

    it('validates legitimate Gregorian harmonics step within {0, 1}', () => {
      const gregorianHarmonics: LeapHarmonic[] = [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ];
      const val = engine.validateHarmonics(gregorianHarmonics);
      expect(val.is_valid).toBe(true);
      expect(val.min_diff).toBe(0);
      expect(val.max_diff).toBe(1);
    });

    it('flags broken harmonics that create invalid step', () => {
      const brokenHarmonics: LeapHarmonic[] = [
        { weight: 2, multiplier_a: 1, shift_b: 0, divisor_c: 2 }, // gives step of 2
      ];
      const val = engine.validateHarmonics(brokenHarmonics);
      expect(val.is_valid).toBe(false);
      expect(val.max_diff).toBe(2);
    });
  });

  describe('Weekdays and Epagomenal Pauses', () => {
    it('calculates standard continuous weekday correctly', () => {
      // 7-day week, day 0 is Monday (0)
      expect(engine.calculateWeekday(0, 0, 0, 7)).toBe(0);
      expect(engine.calculateWeekday(1, 0, 0, 7)).toBe(1);
      expect(engine.calculateWeekday(6, 0, 0, 7)).toBe(6);
      expect(engine.calculateWeekday(7, 0, 0, 7)).toBe(0);
    });

    it('returns null on extra days (epagomenes) with freeze', () => {
      const pauseConfig: WasmWeekdayPauseParams = {
        days_in_regular_months: 360,
        extra_days_base: 5,
        extra_days_leap: 1,
        harmonics: [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }],
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 7,
      };

      // Day within regular months
      const wdRegular = engine.calculateWeekdayWithPause(1, 100, pauseConfig);
      expect(wdRegular).not.toBeNull();

      // Day in epagomenal block (day >= 360)
      const wdEpagomene = engine.calculateWeekdayWithPause(1, 362, pauseConfig);
      expect(wdEpagomene).toBeNull();
    });
  });

  describe('Convergents and Continued Fractions', () => {
    it('approximates Earth tropical year 365.2422 -> 1/4 (Julian) and 97/400 (Gregorian)', () => {
      // 2422 / 10000
      const convergents = engine.calculateLeapConvergents(2422, 10000, 5);
      expect(convergents.length).toBeGreaterThan(0);
      expect(convergents[0].leap_years).toBe(1);
      expect(convergents[0].cycle_years).toBe(4);
    });
  });

  describe('Seasons and Solstice Conflicts', () => {
    it('detects summer season conflict with winter solstice in Northern hemisphere', () => {
      // Months 0..11, winter solstice at month 11 (December)
      // If "Summer" includes month 11, it is a conflict
      const isConflict = engine.isSeasonConflictingWithSolstice(
        [11, 0, 1], // Dec, Jan, Feb designated as Summer
        true,
        11,
        12
      );
      expect(isConflict).toBe(true);
    });
  });

  describe('Moons and Double Full Moon', () => {
    it('calculates rational moon phase', () => {
      const res = engine.calculateAllMoonPhases(0, 86400, [
        {
          name: 'Luna',
          period_days_num: 30,
          period_days_den: 1,
          initial_phase_bp: 5000, // starts full moon
        },
      ]);
      expect(res.length).toBe(1);
      expect(res[0].phase_name).toBe('full_moon');
    });

    it('finds next double full moon when both moons align', () => {
      const moon1: MoonConfig = {
        name: 'M1',
        period_days_num: 10,
        period_days_den: 1,
        initial_phase_bp: 0,
      };
      const moon2: MoonConfig = {
        name: 'M2',
        period_days_num: 30,
        period_days_den: 1,
        initial_phase_bp: 0,
      };

      const doubleFullMoon = engine.findNextDoubleFullMoon(moon1, moon2, 86400, 0, 500);
      expect(doubleFullMoon).not.toBeNull();
    });
  });

  describe('Month Grid Bundle (Batch 120 FPS)', () => {
    it('generates complete month grid in a single call', () => {
      const cultureConfig: WasmCultureConfig = {
        planet_id: 'earth',
        ticks_per_day: 86400,
        day_start_offset: 0,
        base_year_days: 365,
        regular_months: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        harmonics: [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }],
        leap_target: { InMonth: { target_month: 1 } },
        leap_day_offset: 1,
        calendar_origin_day: 0,
        dial: {
          units: [
            { name: 'Hour', subdivisions: 24 },
            { name: 'Minute', subdivisions: 60 },
          ],
        },
        eras: [
          {
            name: 'AD',
            start_year: 1,
            is_count_down: false,
            counting_mode: 'by_calendar_year',
          },
        ],
      };

      const bundle = engine.getMonthGridBundle({
        year: 2024, // Leap year in Gregorian
        month: 1, // February
        config: cultureConfig,
        holidays: [
          {
            name: "Valentine's Day",
            start_month: 1,
            start_day: 14,
            end_month: 1,
            end_day: 14,
            duration_years: 1,
          },
        ],
      });

      expect(bundle.days_count).toBe(29);
      expect(bundle.is_leap_year).toBe(true);
      expect(bundle.days.length).toBe(29);

      const vDay = bundle.days.find((d) => d.day === 14);
      expect(vDay?.is_holiday).toBe(true);
      expect(vDay?.holiday_names).toContain("Valentine's Day");
    });
  });

  describe('Timeline Intervals and Collision', () => {
    it('detects interval overlap', () => {
      expect(engine.intervalsOverlap(10, 20, 15, 25)).toBe(true);
      expect(engine.intervalsOverlap(10, 20, 20, 30)).toBe(false);
    });

    it('detects bilocation conflict when character is in two locations at the same time', () => {
      expect(engine.checkBilocation(10, 20, 'Tavern', 15, 25, 'Castle')).toBe(true);
      expect(engine.checkBilocation(10, 20, 'Tavern', 15, 25, 'Tavern')).toBe(false);
    });

    it('detects death violation when scene occurs after character death', () => {
      expect(engine.checkDeathViolation(10, 25, 20)).toBe(true);
      expect(engine.checkDeathViolation(10, 15, 20)).toBe(false);
    });
  });
});
