/**
 * @file calendar.wasm-bridge.ts
 * @description Мост методов WASM-движка календаря для Vue 3 composable.
 * Обеспечивает строгую маршализацию типов BigInt и Uint32Array в нативный Rust WebAssembly.
 */

import initWasm, {
  WasmCalendarEngine,
  initSync,
  type CalendarAuditReport,
  type CoreEra,
  type CoreHoliday,
  type CoreSeason,
  type DateCoordinate,
  type DialHierarchy,
  type Hemisphere,
  type LeapApproximation,
  type LeapHarmonic,
  type LocalMoment,
  type MonthGridBundle,
  type MonthGridParams,
  type MoonConfig as WasmMoonConfig,
  type MoonDayPhase,
  type MoonPhaseName,
  type WasmAgeParams,
  type WasmCultureConfig,
  type WasmWeekdayPauseParams,
  type YearPreview,
} from '@worldwiki/calendar-wasm';
import type { MoonConfig } from './calendar.types';

let wasmEngineInstance: WasmCalendarEngine | null = null;
let wasmInitPromise: Promise<void> | null = null;
let isWasmInitialized = false;

export function isWasmReady(): boolean {
  return isWasmInitialized && wasmEngineInstance !== null;
}

export async function ensureWasmInitialized(): Promise<WasmCalendarEngine> {
  if (wasmEngineInstance) return wasmEngineInstance;
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm().then(() => {
      wasmEngineInstance = new WasmCalendarEngine();
      isWasmInitialized = true;
    }).catch(err => {
      console.warn('[calendar.wasm-bridge] WASM initialization failed, using JS fallback:', err);
    });
  }
  await wasmInitPromise;
  return wasmEngineInstance!;
}

export function getWasmEngine(): WasmCalendarEngine | null {
  if (!wasmEngineInstance) {
    try {
      wasmEngineInstance = new WasmCalendarEngine();
      isWasmInitialized = true;
    } catch {
      // WASM module not yet ready
      return null;
    }
  }
  return wasmEngineInstance;
}

export const defaultWasmEngine: WasmCalendarEngine = new Proxy({} as WasmCalendarEngine, {
  get(_target, prop, receiver) {
    const engine = getWasmEngine();
    if (engine) {
      const value = Reflect.get(engine, prop, receiver);
      return typeof value === 'function' ? value.bind(engine) : value;
    }
    // JS Fallback while WASM is loading
    if (prop === 'is_leap_year') {
      return (year: bigint | number, rules: Array<{ divisor_c?: number; weight?: number }>, _baseOffset: number) => {
        const y = Number(year);
        if (Array.isArray(rules) && rules.length > 0) {
          let leap = false;
          for (const r of rules) {
            const div = r.divisor_c || 4;
            if (div > 0 && y % div === 0) {
              leap = (r.weight || 1) > 0;
            }
          }
          return leap;
        }
        return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      };
    }
    return () => 0;
  },
});

export const initWasmCalendarEngine = ensureWasmInitialized;

function toWasmMoon(m: MoonConfig): WasmMoonConfig {
  return {
    name: m.name,
    period_days_num: m.period_days_num || Math.round((m.period_days || 28) * 1000),
    period_days_den: m.period_days_den || 1000,
    initial_phase_bp: m.initial_phase_bp ?? Math.round(((m.initial_phase || 0) * 10000) % 10000),
  };
}

export const CalendarWasmBridge = {
  getEngine: () => defaultWasmEngine,
  initWasmCalendarEngine: ensureWasmInitialized,
  initSync,

  tAbsToLocalMoment(tAbs: bigint | number, planetId: string, ticksPerDay: number, dayStartOffset: number = 0): LocalMoment {
    return defaultWasmEngine.t_abs_to_local_moment(BigInt(tAbs), planetId, BigInt(ticksPerDay), BigInt(dayStartOffset));
  },

  localMomentToTAbs(moment: LocalMoment, ticksPerDay: number, dayStartOffset: number = 0): bigint {
    return defaultWasmEngine.local_moment_to_t_abs(moment.planet_id, BigInt(moment.world_day), BigInt(moment.day_tick), BigInt(ticksPerDay), BigInt(dayStartOffset));
  },

  unitsToDayTick(unitValues: number[], hierarchy: DialHierarchy, ticksPerDay: number): number {
    const subdivisions = hierarchy.units?.map((u: { subdivisions: number }) => BigInt(u.subdivisions)) || [];
    const values = unitValues.map((v) => BigInt(v));
    const tick = defaultWasmEngine.units_to_day_tick(BigInt64Array.from(values), BigInt64Array.from(subdivisions), BigInt(ticksPerDay));
    return Number(tick);
  },

  dayTickToUnits(dayTick: number, hierarchy: DialHierarchy, ticksPerDay: number): number[] {
    const subdivisions = hierarchy.units?.map((u: { subdivisions: number }) => BigInt(u.subdivisions)) || [];
    const units = defaultWasmEngine.day_tick_to_units(BigInt(dayTick), BigInt64Array.from(subdivisions), BigInt(ticksPerDay));
    return Array.from(units, Number);
  },

  calculateDriftPerCentury(baseDays: number, harmonics: LeapHarmonic[], targetYearLengthDays: number): number {
    return defaultWasmEngine.drift_per_century(BigInt(baseDays), harmonics, targetYearLengthDays);
  },

  validateHarmonics(harmonics: LeapHarmonic[], _daysOffset: number = 0): { is_valid: boolean; min_diff: number; max_diff: number; period_lcm: number } {
    const isValid = defaultWasmEngine.validate_harmonics(harmonics);
    return { is_valid: isValid, min_diff: isValid ? 0 : -1, max_diff: isValid ? 1 : 2, period_lcm: 400 };
  },

  calculateWeekday(worldDay: number, originDay: number = 0, startWeekday: number = 0, weekdaysCount: number = 7): number {
    return defaultWasmEngine.calculate_weekday(BigInt(worldDay), BigInt(originDay), startWeekday, weekdaysCount);
  },

  calculateWeekdayWithPause(dayOfInternalYear: number, currentYear: number, params: WasmWeekdayPauseParams): number | null {
    return defaultWasmEngine.calculate_weekday_with_pause(BigInt(currentYear), BigInt(dayOfInternalYear), params);
  },

  toCulturalMonth(internalMonthIndex: number, firstMonthOfYear: number, monthsCount: number): number {
    return defaultWasmEngine.to_cultural_month(internalMonthIndex, firstMonthOfYear, monthsCount);
  },

  toInternalMonth(culturalMonthIndex: number, firstMonthOfYear: number, monthsCount: number): number {
    return defaultWasmEngine.to_internal_month(culturalMonthIndex, firstMonthOfYear, monthsCount);
  },

  isHolidayActive(month: number, day: number, startMOrHoliday: number | CoreHoliday, startD?: number, endM?: number, endD?: number): boolean {
    if (typeof startMOrHoliday === 'object') {
      return defaultWasmEngine.is_holiday_active(month, BigInt(day), startMOrHoliday.start_month, BigInt(startMOrHoliday.start_day), startMOrHoliday.end_month, BigInt(startMOrHoliday.end_day));
    }
    return defaultWasmEngine.is_holiday_active(month, BigInt(day), startMOrHoliday, BigInt(startD ?? 1), endM ?? startMOrHoliday, BigInt(endD ?? (startD ?? 1)));
  },

  isMultiYearHolidayActive(year: number, month: number, day: number, holiday: CoreHoliday): boolean {
    return defaultWasmEngine.is_multi_year_holiday_active(BigInt(year), month, BigInt(day), holiday);
  },

  calculateLeapConvergents(targetRatioNum: number, targetRatioDen: number, maxDenominator: number = 10000): LeapApproximation[] {
    return defaultWasmEngine.calculate_leap_convergents(BigInt(targetRatioNum), BigInt(targetRatioDen), maxDenominator);
  },

  decomposeFractionToUnitHarmonics(p: number, q: number, maxHarmonics: number = 3): LeapHarmonic[] {
    return defaultWasmEngine.decompose_fraction_to_unit_harmonics(BigInt(p), BigInt(q), maxHarmonics);
  },

  isSeasonConflictingWithSolstice(seasonMonths: number[], isSummerSeason: boolean, winterSolsticeMonth: number, monthsCount: number): boolean {
    return defaultWasmEngine.is_season_conflicting_with_solstice(Uint32Array.from(seasonMonths), isSummerSeason, winterSolsticeMonth, monthsCount);
  },

  isSeasonConflictingWithSolsticeHemisphere(seasonMonths: number[], isSummerSeason: boolean, winterSolsticeMonth: number, monthsCount: number, hemisphere: Hemisphere): boolean {
    return defaultWasmEngine.is_season_conflicting_with_solstice_hemisphere(Uint32Array.from(seasonMonths), isSummerSeason, winterSolsticeMonth, monthsCount, hemisphere);
  },

  findNextDoubleFullMoon(moonA: MoonConfig, moonB: MoonConfig, ticksPerDay: number = 1440, startTAbs: number = 0, maxSearchDays: number = 3650): number | null {
    return defaultWasmEngine.find_next_double_full_moon(toWasmMoon(moonA), toWasmMoon(moonB), BigInt(ticksPerDay), BigInt(startTAbs), BigInt(maxSearchDays));
  },

  calculateAllMoonPhases(moons: MoonConfig[], worldDayOrTAbs: number, ticksPerDay: number = 1440): MoonDayPhase[] {
    const wasmMoons = (moons || []).map(toWasmMoon);
    return defaultWasmEngine.calculate_all_moon_phases(BigInt(worldDayOrTAbs), BigInt(ticksPerDay), wasmMoons);
  },

  calculateAge(params: WasmAgeParams): number {
    return defaultWasmEngine.calculate_age(params);
  },

  generateYearPreview(year: number, config: WasmCultureConfig, firstMonthOfYear: number = 0): YearPreview {
    return defaultWasmEngine.generate_year_preview(BigInt(year), config, firstMonthOfYear);
  },

  auditCalendarCulture(config: WasmCultureConfig, tropicalYearNumOrDays: number = 3652425, tropicalYearDen: number = 10000): CalendarAuditReport {
    let num = tropicalYearNumOrDays;
    let den = tropicalYearDen;
    if (tropicalYearDen === undefined || tropicalYearNumOrDays < 1000) {
      num = Math.round(tropicalYearNumOrDays * 10000);
      den = 10000;
    }
    return defaultWasmEngine.audit_calendar_culture(config, BigInt(num), BigInt(den));
  },

  calculateLinkedAnchorWorldDay(masterDate: DateCoordinate, masterConfig: WasmCultureConfig, localDate: DateCoordinate, localConfig: WasmCultureConfig): number {
    const res = defaultWasmEngine.calculate_linked_anchor_world_day(masterDate, masterConfig, localDate, localConfig);
    return Number(res);
  },

  dateToTAbs(coord: DateCoordinate, config: WasmCultureConfig): bigint {
    return defaultWasmEngine.date_to_t_abs(coord, config);
  },

  tAbsToDate(tAbs: bigint | number, config: WasmCultureConfig): DateCoordinate {
    return defaultWasmEngine.t_abs_to_date(BigInt(tAbs), config);
  },

  getMonthGridBundle(params: MonthGridParams): MonthGridBundle {
    return defaultWasmEngine.get_month_grid_bundle(params);
  },

  intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
    return defaultWasmEngine.intervals_overlap(BigInt(s1), BigInt(e1), BigInt(s2), BigInt(e2));
  },

  checkBilocation(s1: number, e1: number, loc1: string, s2: number, e2: number, loc2: string): boolean {
    return defaultWasmEngine.check_bilocation(BigInt(s1), BigInt(e1), loc1, BigInt(s2), BigInt(e2), loc2);
  },

  checkDeathViolation(s: number, e: number, deathTAbs: number): boolean {
    return defaultWasmEngine.check_death_violation(BigInt(s), BigInt(e), BigInt(deathTAbs));
  },
};


export type {
  CalendarAuditReport,
  CoreEra,
  CoreHoliday,
  CoreSeason,
  DateCoordinate,
  DialHierarchy,
  Hemisphere,
  LeapApproximation,
  LeapHarmonic,
  LocalMoment,
  MonthGridBundle,
  MonthGridParams,
  MoonDayPhase,
  MoonPhaseName,
  WasmAgeParams,
  WasmCultureConfig,
  WasmWeekdayPauseParams,
  YearPreview,
};
