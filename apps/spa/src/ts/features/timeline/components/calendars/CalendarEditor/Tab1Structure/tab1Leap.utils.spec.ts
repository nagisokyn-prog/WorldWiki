import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ruleToWasmHarmonics,
  isYearLeapCalculated,
  calculateYearTape,
  calculateUpcomingYears,
  calculateCenturyDrift,
  calculateWasmLeapSuggestions,
} from './tab1Leap.utils';
import { CalendarWasmBridge, defaultWasmEngine } from '@/services/Calendars/calendar.wasm-bridge';
import type { CalendarMonth } from '@/services/Calendars/calendar.types';

vi.mock('@/services/Calendars/calendar.wasm-bridge', () => ({
  defaultWasmEngine: {
    is_leap_year: vi.fn(),
    days_in_year: vi.fn(),
  },
  CalendarWasmBridge: {
    calculateDriftPerCentury: vi.fn(),
  },
}));

describe('tab1Leap.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ruleToWasmHarmonics', () => {
    it('returns empty array for none or unknown rule', () => {
      expect(ruleToWasmHarmonics('none')).toEqual([]);
      expect(ruleToWasmHarmonics('unknown' as 'none')).toEqual([]);
    });

    it('builds gregorian, simple, and custom harmonics with leapOffset', () => {
      expect(ruleToWasmHarmonics('gregorian', [], 4, 2)).toEqual([
        { weight: 2, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -2, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 2, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ]);

      expect(ruleToWasmHarmonics('simple', [], 5, 1)).toEqual([
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 5 },
      ]);

      expect(
        ruleToWasmHarmonics(
          'custom',
          [
            { weight: 1, period: 0 },
            { weight: 3, period: 11 },
          ],
          4,
          2
        )
      ).toEqual([{ weight: 6, multiplier_a: 1, shift_b: 0, divisor_c: 11 }]);
    });
  });

  describe('isYearLeapCalculated', () => {
    it('returns false immediately for none', () => {
      expect(isYearLeapCalculated(2024, 'none')).toBe(false);
    });

    it('uses defaultWasmEngine when available', () => {
      vi.mocked(defaultWasmEngine.is_leap_year).mockReturnValue(true);
      expect(isYearLeapCalculated(2024, 'gregorian')).toBe(true);
      expect(defaultWasmEngine.is_leap_year).toHaveBeenCalledWith(
        2024n,
        expect.any(Array),
        0
      );
    });

    it('falls back to JS calculations when WASM throws', () => {
      const dbgSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      vi.mocked(defaultWasmEngine.is_leap_year).mockImplementation(() => {
        throw new Error('wasm unavailable');
      });

      expect(isYearLeapCalculated(2024, 'simple', [], 4)).toBe(true);
      expect(isYearLeapCalculated(2023, 'simple', [], 4)).toBe(false);
      expect(isYearLeapCalculated(2000, 'gregorian')).toBe(true);
      expect(isYearLeapCalculated(1900, 'gregorian')).toBe(false);
      expect(isYearLeapCalculated(2024, 'gregorian')).toBe(true);
      expect(isYearLeapCalculated(15, 'custom', [{ weight: 1, period: 5 }])).toBe(true);
      expect(isYearLeapCalculated(14, 'custom', [{ weight: 1, period: 5 }])).toBe(false);
      expect(isYearLeapCalculated(14, 'unknown' as 'none')).toBe(false);
      dbgSpy.mockRestore();
    });
  });

  describe('calculateYearTape', () => {
    const months: CalendarMonth[] = [
      { название: 'Янв', дней: 31 } as CalendarMonth,
      { название: 'Фев', дней: 28 } as CalendarMonth,
      { название: '', дней: 0 } as CalendarMonth,
      { название: 'Апр', дней: 30 } as CalendarMonth,
    ];

    it('places extra days at start_of_year, mid_year, after_month, and end_of_year', () => {
      const start = calculateYearTape(months, 5, 'Праздник', 'start_of_year', 0, 'in_extra_days', 0, 1);
      expect(start[0]).toMatchObject({ type: 'extra_days', name: 'Праздник', days: 5, isLeapTarget: true, extraBadge: '+1 в високос' });

      const mid = calculateYearTape(months, 2, '', 'mid_year', 0, 'in_month', 1, 2);
      expect(mid[2]).toMatchObject({ type: 'extra_days', name: 'Праздники', days: 2, isLeapTarget: false });
      expect(mid[1]).toMatchObject({ isLeapTarget: true, extraBadge: '+2' });
      expect(mid[3]).toMatchObject({ name: 'Месяц 3', days: 30 });

      const after = calculateYearTape(months, 1, 'Доп', 'after_month', 0, 'in_month', 0, 1);
      expect(after[1]).toMatchObject({ type: 'extra_days', name: 'Доп' });

      const end = calculateYearTape(months, 3, 'Финал', 'end_of_year', 0, 'in_month', 3, 1);
      expect(end[end.length - 1]).toMatchObject({ type: 'extra_days', name: 'Финал' });
    });

    it('omits extra days item when extraDaysCount is 0', () => {
      const tape = calculateYearTape(months, 0, 'Нет', 'end_of_year', 0, 'in_month', 0, 1);
      expect(tape).toHaveLength(4);
      expect(tape.every((i) => i.type === 'month')).toBe(true);
    });
  });

  describe('calculateUpcomingYears', () => {
    it('returns 12 years using WASM engine', () => {
      vi.mocked(defaultWasmEngine.is_leap_year).mockImplementation((y) => Number(y) % 4 === 0);
      vi.mocked(defaultWasmEngine.days_in_year).mockImplementation((y) => (Number(y) % 4 === 0 ? 366n : 365n));

      const res = calculateUpcomingYears(2024, 365, 1, 'gregorian');
      expect(res).toHaveLength(12);
      expect(res[0]).toEqual({ year: 2024, isLeap: true, days: 366 });
      expect(res[1]).toEqual({ year: 2025, isLeap: false, days: 365 });
    });

    it('uses JS fallback for simple, gregorian, custom, and none when WASM throws', () => {
      vi.mocked(defaultWasmEngine.is_leap_year).mockImplementation(() => {
        throw new Error('no wasm');
      });

      const simple = calculateUpcomingYears(1, 300, 2, 'simple', [], 3);
      expect(simple[2]).toEqual({ year: 3, isLeap: true, days: 302 });

      const greg = calculateUpcomingYears(1900, 365, 1, 'gregorian');
      expect(greg[0]).toEqual({ year: 1900, isLeap: false, days: 365 });

      const custom = calculateUpcomingYears(1, 100, 5, 'custom', [{ weight: 1, period: 5 }]);
      expect(custom[4]).toEqual({ year: 5, isLeap: true, days: 105 });

      const none = calculateUpcomingYears(1, 100, 5, 'none');
      expect(none.every((r) => !r.isLeap && r.days === 100)).toBe(true);
    });
  });

  describe('calculateCenturyDrift', () => {
    it('formats drift from CalendarWasmBridge', () => {
      vi.mocked(CalendarWasmBridge.calculateDriftPerCentury).mockReturnValue(0.05);
      expect(calculateCenturyDrift(360, 5, 365.2422, 'gregorian')).toEqual({
        driftCentury: 0.05,
        label: '+0.050 сут/век',
        isOk: true,
      });

      vi.mocked(CalendarWasmBridge.calculateDriftPerCentury).mockReturnValue(-1.25);
      expect(calculateCenturyDrift(360, 5, 365.2422, 'gregorian')).toEqual({
        driftCentury: -1.25,
        label: '-1.250 сут/век',
        isOk: false,
      });
    });

    it('falls back to JS drift calculation for gregorian, simple, custom, and none', () => {
      vi.mocked(CalendarWasmBridge.calculateDriftPerCentury).mockImplementation(() => {
        throw new Error('no wasm');
      });

      const greg = calculateCenturyDrift(360, 5, 365.2425, 'gregorian');
      expect(greg.isOk).toBe(true);

      const simple = calculateCenturyDrift(360, 5, 365.25, 'simple', [{ weight: 1, period: 4 }], 1);
      expect(simple.driftCentury).toBeCloseTo(0, 5);

      const custom = calculateCenturyDrift(
        360,
        5,
        365.2,
        'custom',
        [
          { weight: 1, period: 5 },
          { weight: 1, period: 0 },
        ],
        1
      );
      expect(custom.driftCentury).toBeCloseTo(0, 5);

      const none = calculateCenturyDrift(365, 0, 365.25, 'none');
      expect(none.driftCentury).toBeCloseTo(-25, 5);
    });
  });

  describe('calculateWasmLeapSuggestions', () => {
    it('computes 4 suggestions via WASM and falls back to JS when WASM throws', () => {
      vi.mocked(CalendarWasmBridge.calculateDriftPerCentury).mockReturnValue(0.02);
      const wasmRes = calculateWasmLeapSuggestions(365.2422, 365);
      expect(wasmRes).toHaveLength(4);
      expect(wasmRes[0]).toMatchObject({ key: 'simple', drift: '+0.020 сут/век', isOk: true });

      vi.mocked(CalendarWasmBridge.calculateDriftPerCentury).mockImplementation(() => {
        throw new Error('no wasm');
      });
      const jsRes = calculateWasmLeapSuggestions(365.2422, 365);
      expect(jsRes).toHaveLength(4);
      expect(jsRes.map((r) => r.key)).toEqual(['simple', 'persian', 'gregorian', 'medler']);
      expect(jsRes.find((r) => r.key === 'gregorian')?.isOk).toBe(true);
    });
  });
});

