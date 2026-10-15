import { describe, it, expect } from 'vitest';
import { useCalendarEngine } from '../useCalendarEngine';
import type { DialHierarchy, LeapHarmonic } from '../calendar.types';

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
});
