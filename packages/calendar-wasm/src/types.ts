/**
 * @file types.ts
 * @description Строгие TypeScript интерфейсы и DTO для математического ядра календаря WorldWiki.
 * Полностью соответствуют Rust структурам из `worldwiki-calendar-core` и `worldwiki-calendar-wasm`.
 */

export interface DialUnit {
  name: string;
  subdivisions: number;
}

export interface DialHierarchy {
  units: DialUnit[];
}

export interface LeapHarmonic {
  weight: number;
  multiplier_a: number;
  shift_b: number;
  divisor_c: number;
}

export type LeapTarget =
  | { InMonth: { target_month: number } }
  | 'InExtraDays';

export type EraCountingMode = 'by_calendar_year' | 'by_anniversary' | 'unknown';

export interface CoreEra {
  name: string;
  start_year: number;
  start_month?: number | null;
  start_day?: number | null;
  end_year?: number | null;
  end_month?: number | null;
  end_day?: number | null;
  is_count_down: boolean;
  counting_mode: EraCountingMode;
  priority?: number;
}

export interface DateCoordinate {
  era_index: number;
  year: number;
  month: number;
  day: number;
  unit_values: number[];
}

export interface LocalMoment {
  planet_id: string;
  world_day: number;
  day_tick: number;
}

export interface TimeInterval {
  start: number;
  end: number;
}

export interface WasmCultureConfig {
  planet_id: string;
  ticks_per_day: number;
  day_start_offset: number;
  base_year_days: number;
  regular_months: number[];
  harmonics: LeapHarmonic[];
  leap_target: LeapTarget;
  leap_day_offset: number;
  calendar_origin_day: number;
  dial: DialHierarchy;
  eras: CoreEra[];
}

export interface WasmWeekdayPauseParams {
  days_in_regular_months: number;
  extra_days_base: number;
  extra_days_leap: number;
  harmonics: LeapHarmonic[];
  origin_year: number;
  origin_day: number;
  start_weekday: number;
  weekdays_count: number;
}

export interface CoreHoliday {
  name: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  start_year?: number | null;
  duration_years: number;
}

export type Hemisphere = 'Northern' | 'Southern';

export interface CoreSeason {
  name: string;
  color: string;
  months: number[];
  hemisphere: Hemisphere;
}

export type MoonPhaseName =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export interface MoonConfig {
  name: string;
  period_days_num: number;
  period_days_den: number;
  initial_phase_bp: number;
}

export interface MoonDayPhase {
  moon_name: string;
  basis_points: number;
  phase_name: string;
}

export interface MonthGridDayInfo {
  day: number;
  cal_day: number;
  weekday: number | null;
  is_holiday: boolean;
  holiday_names: string[];
  moon_phases: MoonDayPhase[];
}

export interface MonthGridBundle {
  year: number;
  month: number;
  days_count: number;
  is_leap_year: boolean;
  days: MonthGridDayInfo[];
}

export interface MonthGridParams {
  year: number;
  month: number;
  config: WasmCultureConfig;
  first_month_of_year?: number;
  pause_config?: WasmWeekdayPauseParams;
  start_weekday?: number;
  weekdays_count?: number;
  holidays?: CoreHoliday[];
  moons?: MoonConfig[];
}

export interface MonthPreview {
  cultural_month_index: number;
  internal_month_index: number;
  days_count: number;
}

export interface YearPreview {
  year: number;
  total_days: number;
  is_leap: boolean;
  months: MonthPreview[];
}

export interface CalendarAuditReport {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  drift_milli_days_per_century: number;
  harmonics_cycle_years: number;
}

export interface LeapApproximation {
  leap_years: number;
  cycle_years: number;
}

export interface WasmAgeParams {
  birth_year: number;
  birth_month: number;
  birth_day: number;
  current_year: number;
  current_month: number;
  current_day: number;
  age_at_birth: number;
  step_on_new_year: boolean;
  year_only: boolean;
  max_days_in_birth_month: number;
}
