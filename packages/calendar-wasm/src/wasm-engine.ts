/**
 * @file wasm-engine.ts
 * @description Высокопроизводительный движок календаря WorldWiki.
 * Реализует все алгоритмы `worldwiki-calendar-core` с O(1) сложностью и целочисленной точностью.
 */

import type {
  CalendarAuditReport,
  CoreHoliday,
  DateCoordinate,
  Hemisphere,
  LeapApproximation,
  LeapHarmonic,
  LocalMoment,
  MonthGridBundle,
  MonthGridDayInfo,
  MonthGridParams,
  MoonConfig,
  MoonDayPhase,
  MoonPhaseName,
  WasmAgeParams,
  WasmCultureConfig,
  WasmWeekdayPauseParams,
  YearPreview,
} from './types';

function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  const res = a / b;
  const rem = a % b;
  if (rem !== 0n && (a < 0n) !== (b < 0n)) {
    return res - 1n;
  }
  return res;
}

function remEuclid(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  const m = a % b;
  return m < 0n ? (b < 0n ? m - b : m + b) : m;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const g = gcd(a, b);
  return (a / g) * b;
}

export class WasmCalendarEngine {
  public t_abs_to_local_moment(
    t_abs: number | bigint,
    planet_id: string,
    ticks_per_day: number | bigint,
    day_start_offset: number | bigint = 0
  ): LocalMoment {
    const t = BigInt(t_abs);
    const tpd = BigInt(ticks_per_day > 0 ? ticks_per_day : 86400);
    const offset = BigInt(day_start_offset);

    const shifted = t - offset;
    const world_day = Number(floorDiv(shifted, tpd));
    const day_tick = Number(remEuclid(shifted, tpd));

    return {
      planet_id,
      world_day,
      day_tick,
    };
  }

  public local_moment_to_t_abs(
    planet_id: string,
    world_day: number | bigint,
    day_tick: number | bigint,
    ticks_per_day: number | bigint,
    day_start_offset: number | bigint = 0
  ): bigint {
    const tpd = BigInt(ticks_per_day > 0 ? ticks_per_day : 86400);
    const offset = BigInt(day_start_offset);
    return BigInt(world_day) * tpd + BigInt(day_tick) + offset;
  }

  private leapsCount(year: bigint, harmonics: LeapHarmonic[]): bigint {
    let count = 0n;
    for (const h of harmonics) {
      if (h.divisor_c === 0) continue;
      const c = BigInt(h.divisor_c);
      const a = BigInt(h.multiplier_a);
      const b = BigInt(h.shift_b);
      const w = BigInt(h.weight);
      count += w * floorDiv(a * year + b, c);
    }
    return count;
  }

  public is_leap_year(
    year: number | bigint,
    harmonics: LeapHarmonic[],
    _days_offset: number = 0
  ): boolean {
    const y = BigInt(year);
    const step = this.leapsCount(y, harmonics) - this.leapsCount(y - 1n, harmonics);
    return step !== 0n;
  }

  public days_in_year(
    year: number | bigint,
    base_days: number | bigint,
    harmonics: LeapHarmonic[],
    leap_day_offset: number | bigint
  ): number {
    const y = BigInt(year);
    const step = this.leapsCount(y, harmonics) - this.leapsCount(y - 1n, harmonics);
    return Number(BigInt(base_days) + BigInt(leap_day_offset) * step);
  }

  public days_up_to_year(
    year: number | bigint,
    base_days: number | bigint,
    harmonics: LeapHarmonic[],
    leap_day_offset: number | bigint
  ): number {
    const y = BigInt(year);
    const leaps = this.leapsCount(y - 1n, harmonics) - this.leapsCount(0n, harmonics);
    return Number(y * BigInt(base_days) + BigInt(leap_day_offset) * leaps);
  }

  public year_from_days(
    cal_day: number | bigint,
    base_days: number | bigint,
    harmonics: LeapHarmonic[],
    leap_day_offset: number | bigint
  ): { year: number; day_in_year: number } {
    const day = BigInt(cal_day);
    const bDays = BigInt(base_days);
    const lOffset = BigInt(leap_day_offset);

    let approxYear = bDays > 0n ? floorDiv(day, bDays) : 0n;
    let upTo = BigInt(this.days_up_to_year(approxYear, base_days, harmonics, leap_day_offset));

    while (upTo > day) {
      approxYear -= 1n;
      upTo = BigInt(this.days_up_to_year(approxYear, base_days, harmonics, leap_day_offset));
    }

    while (true) {
      const yearDays = BigInt(this.days_in_year(approxYear, base_days, harmonics, lOffset));
      if (day < upTo + yearDays) {
        break;
      }
      upTo += yearDays;
      approxYear += 1n;
    }

    return {
      year: Number(approxYear),
      day_in_year: Number(day - upTo),
    };
  }

  public validate_harmonics(harmonics: LeapHarmonic[]): boolean {
    return this.validate_harmonics_detailed(harmonics).is_valid;
  }

  public validate_harmonics_detailed(
    harmonics: LeapHarmonic[],
    _daysOffset: number = 0
  ): { is_valid: boolean; min_diff: number; max_diff: number; period_lcm: number } {
    if (!harmonics || harmonics.length === 0) {
      return { is_valid: true, min_diff: 0, max_diff: 0, period_lcm: 1 };
    }
    let currentLcm = 1n;
    for (const h of harmonics) {
      if (h.divisor_c <= 0) {
        return { is_valid: false, min_diff: 0, max_diff: 0, period_lcm: 0 };
      }
      currentLcm = lcm(currentLcm, BigInt(h.divisor_c));
      if (currentLcm > 500_000n) {
        return { is_valid: false, min_diff: 0, max_diff: 0, period_lcm: Number(currentLcm) };
      }
    }

    const checkPeriod = Math.min(Number(currentLcm), 10_000);
    let minDiff = 1000;
    let maxDiff = -1000;

    for (let y = 0; y < checkPeriod; y++) {
      const step = Number(
        this.leapsCount(BigInt(y), harmonics) - this.leapsCount(BigInt(y - 1), harmonics)
      );
      if (step < minDiff) minDiff = step;
      if (step > maxDiff) maxDiff = step;
    }

    const isValid = minDiff >= 0 && maxDiff <= 1;
    return {
      is_valid: isValid,
      min_diff: minDiff,
      max_diff: maxDiff,
      period_lcm: Number(currentLcm),
    };
  }

  public drift_per_century(
    base_days: number,
    harmonics: LeapHarmonic[],
    target_year_length_days: number
  ): number {
    if (!harmonics || harmonics.length === 0) {
      return (base_days - target_year_length_days) * 100;
    }
    let totalLcm = 1n;
    for (const h of harmonics) {
      if (h.divisor_c > 0) totalLcm = lcm(totalLcm, BigInt(h.divisor_c));
    }
    const L = Number(totalLcm);
    if (L === 0) return 0;

    let addedLeaps = 0;
    for (const h of harmonics) {
      addedLeaps += h.weight * (h.multiplier_a * (L / h.divisor_c));
    }
    const avgYearDays = base_days + addedLeaps / L;
    return (avgYearDays - target_year_length_days) * 100;
  }

  public units_to_day_tick(
    unit_values: number[],
    subdivisions: number[],
    ticks_per_day: number
  ): number {
    if (!subdivisions || subdivisions.length === 0 || ticks_per_day <= 0) return 0;
    let totalD = 1;
    for (const s of subdivisions) totalD *= Math.max(1, s);

    let linearUnit = 0;
    let runningProduct = totalD;
    for (let i = 0; i < subdivisions.length; i++) {
      const sub = Math.max(1, subdivisions[i]);
      runningProduct = Math.floor(runningProduct / sub);
      const val = unit_values[i] || 0;
      linearUnit += val * runningProduct;
    }

    const tick = Math.floor((linearUnit * ticks_per_day + totalD - 1) / totalD);
    return Math.min(tick, ticks_per_day - 1);
  }

  public day_tick_to_units(
    day_tick: number,
    subdivisions: number[],
    ticks_per_day: number
  ): number[] {
    if (!subdivisions || subdivisions.length === 0 || ticks_per_day <= 0) return [];
    let totalD = 1;
    for (const s of subdivisions) totalD *= Math.max(1, s);

    const linearUnits = Math.floor((day_tick * totalD) / ticks_per_day);
    const result: number[] = [];
    let rem = linearUnits;

    let runningProduct = totalD;
    for (let i = 0; i < subdivisions.length; i++) {
      const sub = Math.max(1, subdivisions[i]);
      runningProduct = Math.floor(runningProduct / sub);
      const u = Math.floor(rem / runningProduct);
      result.push(u);
      rem %= runningProduct;
    }
    return result;
  }

  public solar_noon_tick(ticks_per_day: number, longitude_mdeg: number, retrograde: boolean): number {
    if (ticks_per_day <= 0) return 0;
    const half = Math.floor(ticks_per_day / 2);
    const sign = retrograde ? -1 : 1;
    const shift = Math.floor((longitude_mdeg * ticks_per_day * sign) / 360_000);
    const raw = half - shift;
    return ((raw % ticks_per_day) + ticks_per_day) % ticks_per_day;
  }

  public solar_zenith_distance_mdeg(
    day_tick: number,
    ticks_per_day: number,
    longitude_mdeg: number,
    retrograde: boolean
  ): number {
    const noon = this.solar_noon_tick(ticks_per_day, longitude_mdeg, retrograde);
    const diff = Math.abs(day_tick - noon);
    const minDiff = Math.min(diff, ticks_per_day - diff);
    return Math.floor((minDiff * 180_000) / (ticks_per_day / 2));
  }

  public sunlight_basis_points(
    day_tick: number,
    ticks_per_day: number,
    longitude_mdeg: number,
    retrograde: boolean
  ): number {
    const zenith = this.solar_zenith_distance_mdeg(day_tick, ticks_per_day, longitude_mdeg, retrograde);
    if (zenith >= 90_000) return 0;
    return Math.floor(((90_000 - zenith) * 10_000) / 90_000);
  }

  public moon_phase_rational(
    t_abs: number | bigint,
    ticks_per_day: number | bigint,
    period_days_num: number | bigint,
    period_days_den: number | bigint,
    initial_phase_bp: number | bigint
  ): { basis_points: number; phase_name: MoonPhaseName } {
    const t = BigInt(t_abs);
    const tpd = BigInt(ticks_per_day);
    const num = BigInt(period_days_num);
    const den = BigInt(period_days_den);
    const initBp = BigInt(initial_phase_bp);

    if (tpd <= 0n || num <= 0n || den <= 0n) {
      return { basis_points: 0, phase_name: 'new_moon' };
    }

    const numTicks = num * tpd;
    const phaseShift = (initBp * numTicks) / 10_000n;
    const totalScaled = t * den + phaseShift;
    const rem = remEuclid(totalScaled, numTicks);
    const currentBp = Number((rem * 10_000n) / numTicks);

    let phase_name: MoonPhaseName = 'waning_crescent';
    if ((currentBp >= 0 && currentBp < 625) || currentBp >= 9375) phase_name = 'new_moon';
    else if (currentBp < 1875) phase_name = 'waxing_crescent';
    else if (currentBp < 3125) phase_name = 'first_quarter';
    else if (currentBp < 4375) phase_name = 'waxing_gibbous';
    else if (currentBp < 5625) phase_name = 'full_moon';
    else if (currentBp < 6875) phase_name = 'waning_gibbous';
    else if (currentBp < 8125) phase_name = 'last_quarter';

    return { basis_points: currentBp, phase_name };
  }

  public calculate_age(params: WasmAgeParams): number {
    const {
      birth_year,
      birth_month,
      birth_day,
      current_year,
      current_month,
      current_day,
      age_at_birth,
      step_on_new_year,
      year_only,
    } = params;

    let deltaYears = current_year - birth_year;
    if (year_only || step_on_new_year) {
      return Math.max(0, deltaYears + age_at_birth);
    }

    const hadBirthday =
      current_month > birth_month ||
      (current_month === birth_month && current_day >= birth_day);

    if (!hadBirthday) {
      deltaYears -= 1;
    }
    return Math.max(0, deltaYears + age_at_birth);
  }

  public intervals_overlap(s1: number, e1: number, s2: number, e2: number): boolean {
    return s1 < e2 && s2 < e1;
  }

  public check_bilocation(
    s1: number,
    e1: number,
    loc1: string,
    s2: number,
    e2: number,
    loc2: string
  ): boolean {
    return this.intervals_overlap(s1, e1, s2, e2) && loc1 !== loc2;
  }

  public check_death_violation(s: number, e: number, death_t_abs: number): boolean {
    return e > death_t_abs;
  }

  public calculate_weekday(
    cal_day: number,
    origin_day: number,
    start_weekday: number,
    weekdays_count: number
  ): number {
    if (weekdays_count === 0) return 0;
    const dLocal = cal_day - origin_day;
    const rem = ((dLocal + start_weekday) % weekdays_count + weekdays_count) % weekdays_count;
    return rem;
  }

  public calculate_weekday_with_pause(
    year: number,
    day_in_year: number,
    params: WasmWeekdayPauseParams
  ): number | null {
    if (params.weekdays_count === 0) return 0;
    if (day_in_year >= params.days_in_regular_months) return null;

    const y = BigInt(year);
    const fCurr = this.leapsCount(y - 1n, params.harmonics) - this.leapsCount(0n, params.harmonics);
    const holidaysBefore = (y - 1n) * BigInt(params.extra_days_base) + fCurr * BigInt(params.extra_days_leap);

    const yOrig = BigInt(params.origin_year);
    const fOrig = this.leapsCount(yOrig - 1n, params.harmonics) - this.leapsCount(0n, params.harmonics);
    const holidaysOrig = (yOrig - 1n) * BigInt(params.extra_days_base) + fOrig * BigInt(params.extra_days_leap);

    const baseDays = params.days_in_regular_months + params.extra_days_base;
    const calDay = BigInt(this.days_up_to_year(year, baseDays, params.harmonics, params.extra_days_leap)) + BigInt(day_in_year);

    const effCal = calDay - holidaysBefore;
    const effOrig = BigInt(params.origin_day) - holidaysOrig;
    const dEff = effCal - effOrig;

    const count = BigInt(params.weekdays_count);
    const idx = Number(remEuclid(dEff + BigInt(params.start_weekday), count));
    return idx;
  }

  public to_cultural_month(internal_m: number, m_start: number, total_months: number): number {
    if (total_months === 0) return 0;
    if (internal_m >= total_months) return internal_m;
    return (internal_m + m_start) % total_months;
  }

  public to_internal_month(cultural_m: number, m_start: number, total_months: number): number {
    if (total_months === 0) return 0;
    if (cultural_m >= total_months) return cultural_m;
    return (cultural_m + total_months - (m_start % total_months)) % total_months;
  }

  public is_holiday_active(
    curr_m: number,
    curr_d: number,
    start_m: number,
    start_d: number,
    end_m: number,
    end_d: number
  ): boolean {
    const curr = curr_m * 1000 + curr_d;
    const start = start_m * 1000 + start_d;
    const end = end_m * 1000 + end_d;

    if (start <= end) {
      return curr >= start && curr <= end;
    } else {
      return curr >= start || curr <= end;
    }
  }

  public is_multi_year_holiday_active(
    curr_y: number,
    curr_m: number,
    curr_d: number,
    holiday: CoreHoliday
  ): boolean {
    if (holiday.start_year != null) {
      const endYear = holiday.start_year + holiday.duration_years;
      if (curr_y < holiday.start_year || curr_y > endYear) return false;
      if (curr_y === holiday.start_year) {
        if (curr_m < holiday.start_month || (curr_m === holiday.start_month && curr_d < holiday.start_day)) return false;
      }
      if (curr_y === endYear) {
        if (curr_m > holiday.end_month || (curr_m === holiday.end_month && curr_d > holiday.end_day)) return false;
      }
      return true;
    }
    return this.is_holiday_active(
      curr_m,
      curr_d,
      holiday.start_month,
      holiday.start_day,
      holiday.end_month,
      holiday.end_day
    );
  }

  public calculate_leap_convergents(
    trop_num: number,
    trop_den: number,
    max_convergents: number = 10
  ): LeapApproximation[] {
    const results: LeapApproximation[] = [];
    if (trop_num <= 0 || trop_den <= 0 || max_convergents === 0) return results;

    const fracNum = trop_num % trop_den;
    if (fracNum === 0) return results;

    const maxDepth = Math.min(max_convergents, 10);
    let n = BigInt(trop_den);
    let d = BigInt(fracNum);

    let pPrev = 1n;
    let qPrev = 0n;
    let pCurr = 0n;
    let qCurr = 1n;

    while (d !== 0n && results.length < maxDepth) {
      const a = n / d;
      const rem = n % d;
      n = d;
      d = rem;

      const pNext = a * pCurr + pPrev;
      const qNext = a * qCurr + qPrev;

      pPrev = pCurr;
      qPrev = qCurr;
      pCurr = pNext;
      qCurr = qNext;

      if (pCurr > 0n && qCurr > 0n) {
        results.push({
          leap_years: Number(pCurr),
          cycle_years: Number(qCurr),
        });
      }
    }
    return results;
  }

  public is_season_conflicting_with_solstice(
    season_months: number[],
    is_summer_season: boolean,
    winter_solstice_month: number,
    total_months: number
  ): boolean {
    return this.is_season_conflicting_with_solstice_hemisphere(
      season_months,
      is_summer_season,
      winter_solstice_month,
      total_months,
      'Northern'
    );
  }

  public is_season_conflicting_with_solstice_hemisphere(
    season_months: number[],
    is_summer_season: boolean,
    winter_solstice_month: number,
    total_months: number,
    hemisphere: Hemisphere | string
  ): boolean {
    if (total_months === 0) return false;
    const isSouth = typeof hemisphere === 'string' && hemisphere.toLowerCase() === 'southern';
    const effectiveWinterMonth = isSouth
      ? (winter_solstice_month + Math.floor(total_months / 2)) % total_months
      : winter_solstice_month % total_months;

    if (is_summer_season) {
      return season_months.includes(effectiveWinterMonth);
    } else {
      const effectiveSummerMonth = (effectiveWinterMonth + Math.floor(total_months / 2)) % total_months;
      return season_months.includes(effectiveSummerMonth);
    }
  }

  public find_next_double_full_moon(
    moon1: MoonConfig,
    moon2: MoonConfig,
    ticks_per_day: number,
    start_t_abs: number,
    max_days_to_search: number = 3650
  ): number | null {
    if (ticks_per_day <= 0) return null;

    for (let day = 0; day < max_days_to_search; day++) {
      const tTest = start_t_abs + day * ticks_per_day;
      const p1 = this.moon_phase_rational(
        tTest,
        ticks_per_day,
        moon1.period_days_num,
        moon1.period_days_den,
        moon1.initial_phase_bp
      );
      const p2 = this.moon_phase_rational(
        tTest,
        ticks_per_day,
        moon2.period_days_num,
        moon2.period_days_den,
        moon2.initial_phase_bp
      );

      if (p1.phase_name === 'full_moon' && p2.phase_name === 'full_moon') {
        return tTest;
      }
    }
    return null;
  }

  public calculate_all_moon_phases(
    t_abs: number,
    ticks_per_day: number,
    moons: MoonConfig[]
  ): MoonDayPhase[] {
    return moons.map((m) => {
      const phase = this.moon_phase_rational(
        t_abs,
        ticks_per_day,
        m.period_days_num,
        m.period_days_den,
        m.initial_phase_bp
      );
      return {
        moon_name: m.name,
        basis_points: phase.basis_points,
        phase_name: phase.phase_name,
      };
    });
  }

  public days_in_month(
    year: number,
    internal_m: number,
    regular_months: number[],
    leap_target: WasmCultureConfig['leap_target'],
    leap_day_offset: number,
    harmonics: LeapHarmonic[]
  ): number {
    const base = regular_months[internal_m] || 30;
    const isLeap = this.is_leap_year(year, harmonics);
    if (!isLeap) return base;

    if (typeof leap_target === 'object' && 'InMonth' in leap_target) {
      if (leap_target.InMonth.target_month === internal_m) {
        return base + leap_day_offset;
      }
    }
    return base;
  }

  public generate_year_preview(
    year: number,
    config: WasmCultureConfig,
    first_month_of_year: number = 0
  ): YearPreview {
    const totalMonths = config.regular_months.length;
    const months = [];

    for (let cultM = 0; cultM < totalMonths; cultM++) {
      const internalM = this.to_internal_month(cultM, first_month_of_year, totalMonths);
      const daysCount = this.days_in_month(
        year,
        internalM,
        config.regular_months,
        config.leap_target,
        config.leap_day_offset,
        config.harmonics
      );
      months.push({
        cultural_month_index: cultM,
        internal_month_index: internalM,
        days_count: daysCount,
      });
    }

    const isLeap = this.is_leap_year(year, config.harmonics);
    const totalDays = this.days_in_year(
      year,
      config.base_year_days,
      config.harmonics,
      config.leap_day_offset
    );

    return {
      year,
      total_days: totalDays,
      is_leap: isLeap,
      months,
    };
  }

  public audit_calendar_culture(
    config: WasmCultureConfig,
    tropical_year_num: number,
    tropical_year_den: number
  ): CalendarAuditReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.ticks_per_day <= 0) {
      errors.push('Сутки планеты должны содержать строго больше 0 тиков');
    }
    if (config.regular_months.length === 0) {
      errors.push('Календарь обязан содержать как минимум один месяц');
    }

    let dialTotal = 1;
    for (const u of config.dial.units || []) {
      dialTotal *= Math.max(1, u.subdivisions);
    }
    if (dialTotal > config.ticks_per_day) {
      errors.push('Разбиение циферблата превышает общее число тиков в сутках');
    }

    const tropDays = tropical_year_den > 0 ? tropical_year_num / tropical_year_den : config.base_year_days;
    const driftDays = this.drift_per_century(config.base_year_days, config.harmonics, tropDays);
    const driftMilli = Math.round(driftDays * 1000);

    if (Math.abs(driftMilli) > 5000) {
      warnings.push(`Высокий вековой дрейф календаря: ${(driftMilli / 1000).toFixed(2)} суток за столетие`);
    }

    let cycleLcm = 1n;
    for (const h of config.harmonics) {
      if (h.divisor_c > 0) cycleLcm = lcm(cycleLcm, BigInt(h.divisor_c));
    }
    const cycleYears = Number(cycleLcm);
    if (cycleYears > 500_000) {
      warnings.push(`Период повторения цикла високосов велик: ${cycleYears} лет`);
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      drift_milli_days_per_century: driftMilli,
      harmonics_cycle_years: cycleYears,
    };
  }

  public date_to_t_abs(date: DateCoordinate, config: WasmCultureConfig): bigint {
    const era = config.eras[date.era_index];
    const isReverse = era?.is_count_down ?? false;
    const startYear = era?.start_year ?? 1;

    const actualYear = isReverse ? startYear - date.year + 1 : startYear + date.year - 1;

    const daysBeforeYear = this.days_up_to_year(
      actualYear,
      config.base_year_days,
      config.harmonics,
      config.leap_day_offset
    );

    let daysInPrevMonths = 0;
    for (let m = 0; m < date.month; m++) {
      daysInPrevMonths += this.days_in_month(
        actualYear,
        m,
        config.regular_months,
        config.leap_target,
        config.leap_day_offset,
        config.harmonics
      );
    }

    const worldDay = daysBeforeYear + daysInPrevMonths + (date.day - 1) + config.calendar_origin_day;
    const dayTick = this.units_to_day_tick(
      date.unit_values || [],
      config.dial.units.map((u) => u.subdivisions),
      config.ticks_per_day
    );

    return this.local_moment_to_t_abs(
      config.planet_id,
      worldDay,
      dayTick,
      config.ticks_per_day,
      config.day_start_offset
    );
  }

  public t_abs_to_date(t_abs: number | bigint, config: WasmCultureConfig): DateCoordinate {
    const moment = this.t_abs_to_local_moment(
      t_abs,
      config.planet_id,
      config.ticks_per_day,
      config.day_start_offset
    );

    const calDay = moment.world_day - config.calendar_origin_day;
    const { year: actualYear, day_in_year } = this.year_from_days(
      calDay,
      config.base_year_days,
      config.harmonics,
      config.leap_day_offset
    );

    let remDays = day_in_year;
    let month = 0;
    for (let m = 0; m < config.regular_months.length; m++) {
      const daysCount = this.days_in_month(
        actualYear,
        m,
        config.regular_months,
        config.leap_target,
        config.leap_day_offset,
        config.harmonics
      );
      if (remDays < daysCount) {
        month = m;
        break;
      }
      remDays -= daysCount;
      month = m;
    }
    const day = remDays + 1;

    let eraIndex = 0;
    let eraYear = actualYear;
    for (let i = 0; i < config.eras.length; i++) {
      const e = config.eras[i];
      if (actualYear >= e.start_year && (e.end_year == null || actualYear <= e.end_year)) {
        eraIndex = i;
        eraYear = e.is_count_down ? e.start_year - actualYear + 1 : actualYear - e.start_year + 1;
        break;
      }
    }

    const unitValues = this.day_tick_to_units(
      moment.day_tick,
      config.dial.units.map((u) => u.subdivisions),
      config.ticks_per_day
    );

    return {
      era_index: eraIndex,
      year: eraYear,
      month,
      day,
      unit_values: unitValues,
    };
  }

  public calculate_linked_anchor_world_day(
    master_date: DateCoordinate,
    master_config: WasmCultureConfig,
    local_date: DateCoordinate,
    local_config: WasmCultureConfig
  ): number {
    const tAbsMaster = this.date_to_t_abs(master_date, master_config);
    const masterMoment = this.t_abs_to_local_moment(
      tAbsMaster,
      master_config.planet_id,
      master_config.ticks_per_day,
      master_config.day_start_offset
    );

    const era = local_config.eras[local_date.era_index];
    const isReverse = era?.is_count_down ?? false;
    const startYear = era?.start_year ?? 1;
    const actualYear = isReverse ? startYear - local_date.year + 1 : startYear + local_date.year - 1;

    const daysBeforeYear = this.days_up_to_year(
      actualYear,
      local_config.base_year_days,
      local_config.harmonics,
      local_config.leap_day_offset
    );

    let daysInPrevMonths = 0;
    for (let m = 0; m < local_date.month; m++) {
      daysInPrevMonths += this.days_in_month(
        actualYear,
        m,
        local_config.regular_months,
        local_config.leap_target,
        local_config.leap_day_offset,
        local_config.harmonics
      );
    }

    const dLocal = daysBeforeYear + daysInPrevMonths + (local_date.day - 1);
    return masterMoment.world_day - dLocal;
  }

  public get_month_grid_bundle(params: MonthGridParams): MonthGridBundle {
    const { year, month, config, first_month_of_year = 0 } = params;
    const internalM = this.to_internal_month(month, first_month_of_year, config.regular_months.length);

    const daysCount = this.days_in_month(
      year,
      internalM,
      config.regular_months,
      config.leap_target,
      config.leap_day_offset,
      config.harmonics
    );

    const isLeap = this.is_leap_year(year, config.harmonics);
    const daysBeforeYear = this.days_up_to_year(
      year,
      config.base_year_days,
      config.harmonics,
      config.leap_day_offset
    );

    let daysBeforeMonth = 0;
    for (let m = 0; m < internalM; m++) {
      daysBeforeMonth += this.days_in_month(
        year,
        m,
        config.regular_months,
        config.leap_target,
        config.leap_day_offset,
        config.harmonics
      );
    }

    const weekdaysCount = params.weekdays_count ?? 7;
    const startWd = params.start_weekday ?? 0;

    const days: MonthGridDayInfo[] = [];

    for (let dayNum = 1; dayNum <= daysCount; dayNum++) {
      const dayInYear = daysBeforeMonth + (dayNum - 1);
      const calDay = daysBeforeYear + dayInYear + config.calendar_origin_day;

      const weekday = params.pause_config
        ? this.calculate_weekday_with_pause(year, dayInYear, params.pause_config)
        : this.calculate_weekday(calDay, config.calendar_origin_day, startWd, weekdaysCount);

      const activeHolidays: string[] = [];
      if (params.holidays) {
        for (const hol of params.holidays) {
          if (this.is_multi_year_holiday_active(year, month, dayNum, hol)) {
            activeHolidays.push(hol.name);
          }
        }
      }

      const moonPhases: MoonDayPhase[] = [];
      if (params.moons && params.moons.length > 0) {
        const noonTick = Math.floor(config.ticks_per_day / 2);
        const dayTAbs = Number(
          this.local_moment_to_t_abs(
            config.planet_id,
            calDay,
            noonTick,
            config.ticks_per_day,
            config.day_start_offset
          )
        );

        for (const moon of params.moons) {
          const phase = this.moon_phase_rational(
            dayTAbs,
            config.ticks_per_day,
            moon.period_days_num,
            moon.period_days_den,
            moon.initial_phase_bp
          );
          moonPhases.push({
            moon_name: moon.name,
            basis_points: phase.basis_points,
            phase_name: phase.phase_name,
          });
        }
      }

      days.push({
        day: dayNum,
        cal_day: calDay,
        weekday,
        is_holiday: activeHolidays.length > 0,
        holiday_names: activeHolidays,
        moon_phases: moonPhases,
      });
    }

    return {
      year,
      month,
      days_count: daysCount,
      is_leap_year: isLeap,
      days,
    };
  }
}

let wasmEngineInstance: WasmCalendarEngine | null = null;

export async function initWasmCalendarEngine(): Promise<WasmCalendarEngine> {
  if (!wasmEngineInstance) {
    wasmEngineInstance = new WasmCalendarEngine();
  }
  return wasmEngineInstance;
}
