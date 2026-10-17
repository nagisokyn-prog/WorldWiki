/**
 * @file useCalendarEngine.ts
 * @description Единый реактивный фасад математического ядра календаря для Vue 3.
 * Работает поверх `@worldwiki/calendar-wasm` с O(1) алгоритмами и целочисленной точностью.
 */

import {
  WasmCalendarEngine,
  initWasmCalendarEngine,
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
  type MoonConfig,
  type MoonDayPhase,
  type MoonPhaseName,
  type WasmAgeParams,
  type WasmCultureConfig,
  type WasmWeekdayPauseParams,
  type YearPreview,
} from '@worldwiki/calendar-wasm';
import { CalendarFormat } from './calendar.format';
import type {
  CalendarData,
  CalendarDate,
  CalendarMonth,
  CalendarEra,
  CalendarSeason,
  CalendarHoliday,
  DaylightResult,
  MoonPhaseResult,
  SyncAnchorDate,
  WorldMoment,
  WorldRegion,
  WorldTimezone,
} from './calendar.types';

const defaultEngine = new WasmCalendarEngine();

export const CalendarEngine = {
  getEngine(): WasmCalendarEngine {
    return defaultEngine;
  },

  getDefaultCalendar(): CalendarData {
    return CalendarFormat.getDefaultCalendar();
  },

  isLeapYear(cal: CalendarData, year: number): boolean {
    if (!cal) return false;
    const rule = cal.правило_високосного_года;
    if (rule === 'нет') return false;
    if (rule === 'каждый 4 год') {
      return defaultEngine.is_leap_year(year, [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }]);
    }
    if (rule === 'григорианский' || rule === 'григорианское' || !rule) {
      return defaultEngine.is_leap_year(year, [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ]);
    }
    return false;
  },

  getBaseDaysInYear(cal: CalendarData): number {
    if (!cal || !cal.месяцы) return 365;
    return cal.месяцы.reduce((acc, m) => acc + (m.дней || 0), 0);
  },

  getDaysInYear(cal: CalendarData, year: number): number {
    const base = this.getBaseDaysInYear(cal);
    if (this.isLeapYear(cal, year)) {
      const offset = cal.пользовательское_високосное_правило?.день_смещения ?? 1;
      return base + offset;
    }
    return base;
  },

  getDaysInMonth(cal: CalendarData, year: number, monthIdx: number): number {
    if (!cal || !cal.месяцы || monthIdx < 0 || monthIdx >= cal.месяцы.length) {
      return 30;
    }
    let days = cal.месяцы[monthIdx]?.дней || 30;
    const isLeap = this.isLeapYear(cal, year);
    const custom = cal.пользовательское_високосное_правило;
    if (isLeap && custom && custom.месяц === monthIdx) {
      days += custom.день_смещения ?? 1;
    }
    return days;
  },

  getAbsoluteMinute(date: any, cal: CalendarData): number {
    if (!cal) return 0;
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    const y = Number(date.year ?? 1);
    const m = Number(date.month ?? 0);
    const d = Number(date.day ?? 1);
    const h = Number(date.hour ?? 0);
    const min = Number(date.minute ?? 0);

    const baseDays = this.getBaseDaysInYear(cal);
    const harmonics = (cal.правило_високосного_года === 'каждый 4 год')
      ? [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }]
      : [
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
          { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
        ];
    const leapOffset = cal.пользовательское_високосное_правило?.день_смещения ?? 1;

    let totalDays = defaultEngine.days_up_to_year(y, baseDays, harmonics, leapOffset);
    for (let mi = 0; mi < m; mi++) {
      totalDays += this.getDaysInMonth(cal, y, mi);
    }
    totalDays += (d - 1);

    return totalDays * minsInDay + h * mInHour + min;
  },

  getDateFromAbsolute(absMin: number, cal: CalendarData, eraIndex: number = 0): any {
    if (!cal) return { year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0 };
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    const dayIndex = Math.floor(absMin / minsInDay);
    const remMin = ((absMin % minsInDay) + minsInDay) % minsInDay;
    const hour = Math.floor(remMin / mInHour);
    const minute = remMin % mInHour;

    const baseDays = this.getBaseDaysInYear(cal);
    const harmonics = (cal.правило_високосного_года === 'каждый 4 год')
      ? [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }]
      : [
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
          { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
        ];
    const leapOffset = cal.пользовательское_високосное_правило?.день_смещения ?? 1;

    const year = defaultEngine.year_from_days(dayIndex, baseDays, harmonics, leapOffset);
    const yearStartDay = defaultEngine.days_up_to_year(year, baseDays, harmonics, leapOffset);
    let dayInYear = dayIndex - yearStartDay;

    let month = 0;
    const monthsCount = cal.месяцы?.length || 12;
    for (let mi = 0; mi < monthsCount; mi++) {
      const dim = this.getDaysInMonth(cal, year, mi);
      if (dayInYear < dim) {
        month = mi;
        break;
      }
      dayInYear -= dim;
    }
    const day = dayInYear + 1;

    return {
      era_index: eraIndex,
      year,
      month,
      day,
      hour,
      minute
    };
  },

  getAnchorOffset(localCal?: CalendarData | null, masterCal?: CalendarData | null): number {
    if (!localCal || !masterCal) return 0;
    const anchor = localCal?.sync_anchor;
    if (!anchor || !anchor.linked_to_master || !anchor.local_anchor_date || !anchor.master_anchor_date) {
      return 0;
    }
    const localMin = this.getAbsoluteMinute(anchor.local_anchor_date, localCal);
    const masterMin = this.getAbsoluteMinute(anchor.master_anchor_date, masterCal);
    return masterMin - localMin;
  },

  localDateToMasterMinute(date: any, localCal?: CalendarData | null, masterCal?: CalendarData | null): number {
    if (!localCal) return 0;
    const localMin = this.getAbsoluteMinute(date, localCal);
    if (!masterCal) return localMin;
    const offset = this.getAnchorOffset(localCal, masterCal);
    return localMin + offset;
  },

  masterMinuteToLocalDate(masterMin: number, localCal?: CalendarData | null, masterCal?: CalendarData | null, eraIndex: number = 0): any {
    if (!localCal) return { year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0 };
    const offset = this.getAnchorOffset(localCal, masterCal);
    const localMin = masterMin - offset;
    return this.getDateFromAbsolute(localMin, localCal, eraIndex);
  },

  convertDateBetweenCalendars(
    date: any,
    sourceCal?: CalendarData | null,
    targetCal?: CalendarData | null,
    masterCal?: CalendarData | null,
    eraIndex: number = 0
  ): any {
    if (!sourceCal || !targetCal) return date;
    const masterMin = this.localDateToMasterMinute(date, sourceCal, masterCal);
    return this.masterMinuteToLocalDate(masterMin, targetCal, masterCal, eraIndex);
  },

  formatAnchorOffsetDescription(localCal?: CalendarData | null, masterCal?: CalendarData | null): string {
    if (!localCal || !masterCal) return 'Нет данных для синхронизации';
    const anchor = localCal?.sync_anchor;
    if (!anchor || !anchor.linked_to_master) return 'Календарь ещё не привязан к Календарю Мира.';
    const localDate = anchor.local_anchor_date;
    const masterDate = anchor.master_anchor_date;
    if (!localDate || !masterDate) return 'Синхронизация отключена';
    if (localDate.year === masterDate.year && localDate.month === masterDate.month && localDate.day === masterDate.day) {
      return 'Точка отсчета совпадает с началом Календаря Мира.';
    }
    if (localDate.year > masterDate.year) {
      return `Летоисчисление началось раньше Календаря Мира на ${localDate.year - masterDate.year} г.`;
    }
    return `Летоисчисление началось позже Календаря Мира на ${masterDate.year - localDate.year} г.`;
  },

  formatDate(calendar: CalendarData, dateObj: any): string {
    return CalendarFormat.formatDate(calendar, dateObj);
  },

  formatDateShort(calendar: CalendarData, dateObj: any): string {
    if (!dateObj || !dateObj.original_input) return '';
    const { year, month, day } = dateObj.original_input;
    const monthName = calendar.месяцы?.[month]?.название || `${month + 1}`;
    return `${day} ${monthName} ${year}`;
  },

  getSeasonForDate(calendar: CalendarData, year: number, monthIdx: number): string {
    return CalendarFormat.getSeasonForDate(calendar, year, monthIdx);
  },

  isHoliday(calendar: CalendarData, year: number, monthIdx: number, day: number): boolean {
    return CalendarFormat.isHoliday(calendar, year, monthIdx, day);
  },

  calculateDaylight(absMin: number, cal: CalendarData): DaylightResult | null {
    if (!cal?.настройки_времени?.учитывать_сезонную_длительность_дня) return null;
    const anchor = cal.day_length_anchor || { summer_solstice_hours: 16, winter_solstice_hours: 8 };
    const hInDay = cal.настройки_времени.часов_в_сутках || 24;
    const mInHour = cal.настройки_времени.минут_в_часе || 60;
    const avg = (anchor.summer_solstice_hours + anchor.winter_solstice_hours) / 2;
    const amp = (anchor.summer_solstice_hours - anchor.winter_solstice_hours) / 2;
    const yearMins = this.getDaysInYear(cal, 1) * hInDay * mInHour;
    const progress = (absMin % yearMins) / yearMins;
    const duration = avg + amp * Math.sin(progress * 2 * Math.PI);
    const half = duration / 2;
    const noon = hInDay / 2;
    const sunrise = Math.max(0, noon - half);
    const sunset = Math.min(hInDay, noon + half);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    return {
      sunrise: `${pad(Math.floor(sunrise))}:${pad(Math.floor((sunrise - Math.floor(sunrise)) * mInHour))}`,
      sunset: `${pad(Math.floor(sunset))}:${pad(Math.floor((sunset - Math.floor(sunset)) * mInHour))}`,
      zenith: `${pad(Math.floor(noon))}:00`,
      duration_hours: duration
    };
  },

  formatDaylightLiterary(daylight?: DaylightResult | null): { duration: string; sunrise: string; sunset: string } | null {
    if (!daylight) return null;
    const hours = Math.floor(daylight.duration_hours);
    const mins = Math.round((daylight.duration_hours - hours) * 60);
    return {
      duration: `Световой день: ${hours} ч ${mins} мин`,
      sunrise: `Восход: ${daylight.sunrise}`,
      sunset: `Закат: ${daylight.sunset}`,
    };
  },

  parseDurationString(input: string, cal: CalendarData): number {
    return CalendarFormat.parseDurationString(input, cal, (c, y) => this.getDaysInYear(c, y));
  },

  explainDate(date: any, cal: CalendarData, allCals: CalendarData[], masterCal: CalendarData): any {
    const localFormatted = this.formatDate(cal, { original_input: date });
    const masterMin = this.localDateToMasterMinute(date, cal, masterCal);
    const masterDate = this.getDateFromAbsolute(masterMin, masterCal, 0);
    const masterFormatted = this.formatDate(masterCal, { original_input: masterDate });
    const otherCalendars = allCals
      .filter(c => c._id !== cal._id && c._id !== masterCal._id)
      .map(c => {
        const d = this.masterMinuteToLocalDate(masterMin, c, masterCal, 0);
        return {
          calendar_name: c.название,
          formatted: this.formatDate(c, { original_input: d })
        };
      });

    return {
      localFormatted,
      masterFormatted,
      otherCalendars,
      season: this.getSeasonForDate(cal, date.year, date.month),
      is_holiday: this.isHoliday(cal, date.year, date.month, date.day)
    };
  }
};

export const CalendarMath = CalendarEngine;

export function useCalendarEngine() {
  const getEngine = (): WasmCalendarEngine => defaultEngine;

  const tAbsToLocalMoment = (
    tAbs: bigint | number,
    planetId: string,
    ticksPerDay: number,
    dayStartOffset: number = 0
  ): LocalMoment => {
    return defaultEngine.t_abs_to_local_moment(tAbs, planetId, ticksPerDay, dayStartOffset);
  };

  const localMomentToTAbs = (
    moment: LocalMoment,
    ticksPerDay: number,
    dayStartOffset: number = 0
  ): bigint => {
    return defaultEngine.local_moment_to_t_abs(
      moment.planet_id,
      moment.world_day,
      moment.day_tick,
      ticksPerDay,
      dayStartOffset
    );
  };

  const unitsToDayTick = (
    unitValues: number[],
    hierarchy: DialHierarchy,
    ticksPerDay: number
  ): number => {
    return defaultEngine.units_to_day_tick(
      unitValues,
      hierarchy.units?.map((u: { subdivisions: number }) => u.subdivisions) || [],
      ticksPerDay
    );
  };

  const dayTickToUnits = (
    dayTick: number,
    hierarchy: DialHierarchy,
    ticksPerDay: number
  ): number[] => {
    return defaultEngine.day_tick_to_units(
      dayTick,
      hierarchy.units?.map((u: { subdivisions: number }) => u.subdivisions) || [],
      ticksPerDay
    );
  };

  const calculateDriftPerCentury = (
    baseDays: number,
    harmonics: LeapHarmonic[],
    targetYearLengthDays: number
  ): number => {
    return defaultEngine.drift_per_century(baseDays, harmonics, targetYearLengthDays);
  };

  const validateHarmonics = (
    harmonics: LeapHarmonic[],
    daysOffset: number = 0
  ): { is_valid: boolean; min_diff: number; max_diff: number; period_lcm: number } => {
    return defaultEngine.validate_harmonics_detailed(harmonics, daysOffset);
  };

  const isLeapYear = (
    year: number | bigint,
    harmonics: LeapHarmonic[],
    daysOffset: number = 0
  ): boolean => {
    return defaultEngine.is_leap_year(year, harmonics, daysOffset);
  };

  const daysInYear = (
    year: number | bigint,
    baseYearDays: number,
    harmonics: LeapHarmonic[],
    leapDayOffset: number = 1
  ): number => {
    return defaultEngine.days_in_year(year, baseYearDays, harmonics, leapDayOffset);
  };

  const daysUpToYear = (
    year: number | bigint,
    baseYearDays: number,
    harmonics: LeapHarmonic[],
    leapDayOffset: number = 1
  ): number => {
    return defaultEngine.days_up_to_year(year, baseYearDays, harmonics, leapDayOffset);
  };

  const yearFromDays = (
    totalDays: number,
    baseYearDays: number,
    harmonics: LeapHarmonic[],
    leapDayOffset: number = 1
  ): number => {
    return defaultEngine.year_from_days(totalDays, baseYearDays, harmonics, leapDayOffset);
  };

  const calculateWeekday = (
    worldDay: number,
    startWeekday: number = 0,
    weekdaysCount: number = 7
  ): number => {
    return defaultEngine.calculate_weekday(worldDay, startWeekday, weekdaysCount);
  };

  const calculateWeekdayWithPause = (
    dayOfInternalYear: number,
    currentYear: number,
    params: WasmWeekdayPauseParams
  ): number | null => {
    return defaultEngine.calculate_weekday_with_pause(dayOfInternalYear, currentYear, params);
  };

  const toCulturalMonth = (
    internalMonthIndex: number,
    firstMonthOfYear: number,
    monthsCount: number
  ): number => {
    return defaultEngine.to_cultural_month(internalMonthIndex, firstMonthOfYear, monthsCount);
  };

  const toInternalMonth = (
    culturalMonthIndex: number,
    firstMonthOfYear: number,
    monthsCount: number
  ): number => {
    return defaultEngine.to_internal_month(culturalMonthIndex, firstMonthOfYear, monthsCount);
  };

  const isHolidayActive = (
    month: number,
    day: number,
    holiday: CoreHoliday,
    currentYear?: number | null
  ): boolean => {
    return defaultEngine.is_holiday_active(month, day, holiday, currentYear);
  };

  const isMultiYearHolidayActive = (
    year: number,
    month: number,
    day: number,
    holiday: CoreHoliday
  ): boolean => {
    return defaultEngine.is_multi_year_holiday_active(year, month, day, holiday);
  };

  const calculateLeapConvergents = (
    targetRatioNum: number,
    targetRatioDen: number,
    maxDenominator: number = 10000
  ): LeapApproximation[] => {
    return defaultEngine.calculate_leap_convergents(targetRatioNum, targetRatioDen, maxDenominator);
  };

  const isSeasonConflictingWithSolstice = (
    seasonMonths: number[],
    isSummerSeason: boolean,
    winterSolsticeMonth: number,
    monthsCount: number
  ): boolean => {
    return defaultEngine.is_season_conflicting_with_solstice(
      seasonMonths,
      isSummerSeason,
      winterSolsticeMonth,
      monthsCount
    );
  };

  const isSeasonConflictingWithSolsticeHemisphere = (
    seasonMonths: number[],
    isSummerSeason: boolean,
    winterSolsticeMonth: number,
    monthsCount: number,
    hemisphere: Hemisphere
  ): boolean => {
    return defaultEngine.is_season_conflicting_with_solstice_hemisphere(
      seasonMonths,
      isSummerSeason,
      winterSolsticeMonth,
      monthsCount,
      hemisphere
    );
  };

  const findNextDoubleFullMoon = (
    moonA: MoonConfig,
    moonB: MoonConfig,
    startDay: number,
    maxSearchDays: number = 36500
  ): number | null => {
    return defaultEngine.find_next_double_full_moon(moonA, moonB, startDay, maxSearchDays);
  };

  const calculateAllMoonPhases = (
    moons: MoonConfig[],
    worldDay: number
  ): MoonDayPhase[] => {
    return defaultEngine.calculate_all_moon_phases(moons, worldDay);
  };

  const calculateAge = (params: WasmAgeParams): number => {
    return defaultEngine.calculate_age(params);
  };

  const generateYearPreview = (
    year: number,
    config: WasmCultureConfig,
    firstMonthOfYear: number = 0
  ): YearPreview => {
    return defaultEngine.generate_year_preview(year, config, firstMonthOfYear);
  };

  const auditCalendarCulture = (
    config: WasmCultureConfig,
    targetYearLengthDays: number = 365.2425
  ): CalendarAuditReport => {
    return defaultEngine.audit_calendar_culture(config, targetYearLengthDays);
  };

  const calculateLinkedAnchorWorldDay = (
    sourceDay: number,
    sourceAnchorDay: number,
    masterAnchorDay: number
  ): number => {
    return defaultEngine.calculate_linked_anchor_world_day(sourceDay, sourceAnchorDay, masterAnchorDay);
  };

  const dateToTAbs = (config: WasmCultureConfig, coord: DateCoordinate): bigint => {
    return defaultEngine.date_to_t_abs(config, coord);
  };

  const tAbsToDate = (config: WasmCultureConfig, tAbs: bigint | number): DateCoordinate => {
    return defaultEngine.t_abs_to_date(config, tAbs);
  };

  const getMonthGridBundle = (params: MonthGridParams): MonthGridBundle => {
    return defaultEngine.get_month_grid_bundle(params);
  };

  const intervalsOverlap = (s1: number, e1: number, s2: number, e2: number): boolean => {
    return defaultEngine.intervals_overlap(s1, e1, s2, e2);
  };

  const checkBilocation = (
    e1Start: number,
    e1End: number,
    e2Start: number,
    e2End: number
  ): boolean => {
    return defaultEngine.check_bilocation(e1Start, e1End, e2Start, e2End);
  };

  const checkDeathViolation = (s: number, e: number, deathTAbs: number): boolean => {
    return defaultEngine.check_death_violation(s, e, deathTAbs);
  };

  return {
    ...CalendarEngine,
    getEngine,
    initWasmCalendarEngine,
    tAbsToLocalMoment,
    localMomentToTAbs,
    unitsToDayTick,
    dayTickToUnits,
    calculateDriftPerCentury,
    validateHarmonics,
    calculateWeekday,
    calculateWeekdayWithPause,
    toCulturalMonth,
    toInternalMonth,
    isHolidayActive,
    isMultiYearHolidayActive,
    calculateLeapConvergents,
    isSeasonConflictingWithSolstice,
    isSeasonConflictingWithSolsticeHemisphere,
    findNextDoubleFullMoon,
    calculateAllMoonPhases,
    calculateAge,
    generateYearPreview,
    auditCalendarCulture,
    calculateLinkedAnchorWorldDay,
    dateToTAbs,
    tAbsToDate,
    getMonthGridBundle,
    intervalsOverlap,
    checkBilocation,
    checkDeathViolation,
  };
}

export { initWasmCalendarEngine };
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
  MoonConfig,
  MoonDayPhase,
  MoonPhaseName,
  WasmAgeParams,
  WasmCultureConfig,
  WasmWeekdayPauseParams,
  YearPreview,
};
