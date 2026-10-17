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
  type MoonConfig as WasmMoonConfig,
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
  DaylightResult,
  LoreDateExplanation,
  MoonConfig,
  MoonPhaseResult,
  RegionSunStatus,
  SyncAnchorDate,
  WorldMoment,
  WorldRegion,
  WorldTimezone,
} from './calendar.types';

export interface CalendarDateParts {
  era_index?: number;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  timezone_key?: string;
}

export type CalendarDateInput = CalendarDateParts | CalendarDate | { original_input?: CalendarDateParts };

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

  getAbsoluteMinute(date: CalendarDateInput, cal: CalendarData): number {
    if (!cal) return 0;
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    const raw = (date && typeof date === 'object' && 'original_input' in date && date.original_input)
      ? date.original_input
      : (date as CalendarDateParts);

    const y = Number(raw?.year ?? 1);
    const m = Number(raw?.month ?? 0);
    const d = Number(raw?.day ?? 1);
    const h = Number(raw?.hour ?? 0);
    const min = Number(raw?.minute ?? 0);

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

  getDateFromAbsolute(absMin: number, cal: CalendarData, eraIndex: number = 0): SyncAnchorDate {
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

    const yearRes = defaultEngine.year_from_days(dayIndex, baseDays, harmonics, leapOffset);
    const year = typeof yearRes === 'object' ? yearRes.year : Number(yearRes);
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

  localDateToMasterMinute(date: CalendarDateInput, localCal?: CalendarData | null, masterCal?: CalendarData | null): number {
    if (!localCal) return 0;
    const localMin = this.getAbsoluteMinute(date, localCal);
    if (!masterCal) return localMin;
    const offset = this.getAnchorOffset(localCal, masterCal);
    return localMin + offset;
  },

  masterMinuteToLocalDate(masterMin: number, localCal?: CalendarData | null, masterCal?: CalendarData | null, eraIndex: number = 0): SyncAnchorDate {
    if (!localCal) return { year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0 };
    const offset = this.getAnchorOffset(localCal, masterCal);
    const localMin = masterMin - offset;
    return this.getDateFromAbsolute(localMin, localCal, eraIndex);
  },

  convertDateBetweenCalendars(
    date: CalendarDateInput,
    sourceCal?: CalendarData | null,
    targetCal?: CalendarData | null,
    masterCal?: CalendarData | null,
    eraIndex: number = 0
  ): SyncAnchorDate {
    if (!sourceCal || !targetCal) {
      const raw = (date && typeof date === 'object' && 'original_input' in date && date.original_input)
        ? date.original_input
        : (date as CalendarDateParts);
      return {
        era_index: raw?.era_index ?? eraIndex,
        year: raw?.year ?? 1,
        month: raw?.month ?? 0,
        day: raw?.day ?? 1,
        hour: raw?.hour ?? 0,
        minute: raw?.minute ?? 0,
      };
    }
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

  formatDate(calendar: CalendarData, dateObj: CalendarDate | { original_input?: CalendarDateParts }): string {
    return CalendarFormat.formatDate(calendar, dateObj as unknown as CalendarDate);
  },

  formatDateShort(calendar: CalendarData, dateObj: CalendarDate | { original_input?: CalendarDateParts }): string {
    if (!dateObj || !dateObj.original_input) return '';
    const { year, month, day } = dateObj.original_input;
    const monthName = (month !== undefined && calendar.месяцы?.[month]?.название) ? calendar.месяцы[month].название : `${(month ?? 0) + 1}`;
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

  calculateMoonPhases(absMin: number, moons: MoonConfig[], cal?: CalendarData): MoonPhaseResult[] {
    if (!moons || moons.length === 0) return [];
    const settings = cal?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    return moons.map((m: MoonConfig) => {
      const periodNum = m.period_days_num || Math.round((m.period_days || 28) * 1000);
      const periodDen = m.period_days_den || 1000;
      const initialPhaseBp = m.initial_phase_bp ?? Math.round(((m.initial_phase || 0) * 10000) % 10000);

      const res = defaultEngine.moon_phase_rational(
        absMin,
        minsInDay,
        periodNum,
        periodDen,
        initialPhaseBp
      );

      const emojis: Record<string, string> = {
        new_moon: '🌑',
        waxing_crescent: '🌒',
        first_quarter: '🌓',
        waxing_gibbous: '🌔',
        full_moon: '🌕',
        waning_gibbous: '🌖',
        last_quarter: '🌗',
        waning_crescent: '🌘',
      };

      const titles: Record<string, string> = {
        new_moon: 'Новолуние',
        waxing_crescent: 'Молодая луна',
        first_quarter: 'Первая четверть',
        waxing_gibbous: 'Прибывающая луна',
        full_moon: 'Полнолуние',
        waning_gibbous: 'Убывающая луна',
        last_quarter: 'Последняя четверть',
        waning_crescent: 'Старая луна',
      };

      const phaseFrac = res.basis_points / 10000;
      const title = titles[res.phase_name] || res.phase_name;

      return {
        moon: m,
        phase: phaseFrac,
        name: m.name || title,
        phaseName: title,
        emoji: emojis[res.phase_name] || '🌕',
        dayInCycle: phaseFrac * (periodNum / periodDen),
      };
    });
  },

  getTimezoneOffsetForDay(tz: WorldTimezone, dayIndex: number): number {
    if (tz.historical_rules && tz.historical_rules.length > 0) {
      for (const rule of tz.historical_rules) {
        const start = rule.start_world_day ?? -Infinity;
        const end = rule.end_world_day ?? Infinity;
        if (dayIndex >= start && dayIndex <= end) {
          return rule.offset_hours;
        }
      }
    }
    return tz.base_offset_hours || 0;
  },

  dateToWorldMoment(date: CalendarDateInput, cal: CalendarData, offsetHours: number = 0): WorldMoment {
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;
    const absMin = this.getAbsoluteMinute(date, cal) - offsetHours * mInHour;
    const day_index = Math.floor(absMin / minsInDay);
    const day_fraction = (((absMin % minsInDay) + minsInDay) % minsInDay) / minsInDay;
    return {
      day_index,
      day_fraction,
    };
  },

  worldMomentToDate(moment: WorldMoment, cal: CalendarData, offsetHours: number = 0): SyncAnchorDate {
    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;
    const totalMin = Math.round(moment.day_index * minsInDay + moment.day_fraction * minsInDay + offsetHours * mInHour);
    return this.getDateFromAbsolute(totalMin, cal, 0);
  },

  calculateSunForRegion(
    region: WorldRegion,
    moment: WorldMoment,
    cal: CalendarData,
    _timezones?: WorldTimezone[]
  ): RegionSunStatus {
    const daylight = this.calculateDaylight(Math.round(moment.day_index * 1440 + moment.day_fraction * 1440), cal);
    const frac = moment.day_fraction;
    const getSunPhase = (f: number): { phase: 'dawn' | 'day' | 'dusk' | 'night'; phase_label: string } => {
      if (f >= 0.22 && f < 0.28) {
        return { phase: 'dawn', phase_label: 'Рассвет / Сумерки' };
      }
      if (f >= 0.28 && f < 0.72) {
        return { phase: 'day', phase_label: 'День / Солнце в зените' };
      }
      if (f >= 0.72 && f < 0.78) {
        return { phase: 'dusk', phase_label: 'Закат / Вечерние сумерки' };
      }
      return { phase: 'night', phase_label: 'Ночь / Тьма' };
    };

    const { phase, phase_label } = getSunPhase(frac);

    const sunrise_time = daylight?.sunrise || '06:00';
    const sunset_time = daylight?.sunset || '18:00';
    const zenith_time = daylight?.zenith || '12:00';
    const daylight_text = daylight
      ? `Световой день ~${Math.round(daylight.duration_hours)} ч.`
      : 'Стандартный световой день';

    return {
      phase,
      phase_label,
      daylight_text,
      sunrise_time,
      sunset_time,
      zenith_time,
      note: region.name ? `Регион: ${region.name}` : undefined
    };
  },

  parseDurationString(input: string, cal: CalendarData): number {
    return CalendarFormat.parseDurationString(input, cal, (c, y) => this.getDaysInYear(c, y));
  },

  explainDate(
    date: CalendarDateParts,
    cal: CalendarData,
    allCals: CalendarData[],
    masterCal: CalendarData
  ): LoreDateExplanation {
    const localFormatted = this.formatDate(cal, { original_input: date });
    const masterMin = this.localDateToMasterMinute(date, cal, masterCal);
    const masterDate = this.getDateFromAbsolute(masterMin, masterCal, 0);
    const masterFormatted = this.formatDate(masterCal, { original_input: masterDate });
    const crossDates = allCals
      .filter(c => c._id !== cal._id && c._id !== masterCal._id)
      .map(c => {
        const d = this.masterMinuteToLocalDate(masterMin, c, masterCal, 0);
        return {
          calendarName: c.название,
          formatted: this.formatDate(c, { original_input: d })
        };
      });

    const moons = this.calculateMoonPhases(masterMin, cal.moons || [], cal);
    const daylight = this.calculateDaylight(masterMin, cal);
    const season = this.getSeasonForDate(cal, date.year ?? 1, date.month ?? 0);
    const isHoliday = this.isHoliday(cal, date.year ?? 1, date.month ?? 0, date.day ?? 1);
    const holidays = isHoliday ? ['Праздничный день'] : [];

    const moonSnippet = moons.length > 0 ? `на небе сияла ${moons[0].name}` : '';
    const snippet = `Шёл ${localFormatted} (${season}), что соответствовало ${masterFormatted} по Календарю Мира.${moonSnippet ? ' ' + moonSnippet + '.' : ''}`;

    return {
      masterDateFormatted: masterFormatted,
      localDateFormatted: localFormatted,
      crossDates,
      moons,
      daylightText: daylight ? `Световой день: ~${Math.round(daylight.duration_hours)} ч.` : undefined,
      sunriseText: daylight ? `Восход: ${daylight.sunrise}` : undefined,
      sunsetText: daylight ? `Закат: ${daylight.sunset}` : undefined,
      holidays,
      snippet
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

  const calculateWeekday = (
    worldDay: number,
    originDay: number = 0,
    startWeekday: number = 0,
    weekdaysCount: number = 7
  ): number => {
    return defaultEngine.calculate_weekday(worldDay, originDay, startWeekday, weekdaysCount);
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
    startMOrHoliday: number | CoreHoliday,
    startD?: number,
    endM?: number,
    endD?: number
  ): boolean => {
    if (typeof startMOrHoliday === 'object') {
      return defaultEngine.is_holiday_active(
        month,
        day,
        startMOrHoliday.start_month,
        startMOrHoliday.start_day,
        startMOrHoliday.end_month,
        startMOrHoliday.end_day
      );
    }
    return defaultEngine.is_holiday_active(
      month,
      day,
      startMOrHoliday,
      startD ?? 1,
      endM ?? startMOrHoliday,
      endD ?? (startD ?? 1)
    );
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
    ticksPerDay: number = 1440,
    startTAbs: number = 0,
    maxSearchDays: number = 3650
  ): number | null => {
    const wasmMoonA: WasmMoonConfig = {
      name: moonA.name,
      period_days_num: moonA.period_days_num || Math.round((moonA.period_days || 28) * 1000),
      period_days_den: moonA.period_days_den || 1000,
      initial_phase_bp: moonA.initial_phase_bp ?? Math.round(((moonA.initial_phase || 0) * 10000) % 10000),
    };
    const wasmMoonB: WasmMoonConfig = {
      name: moonB.name,
      period_days_num: moonB.period_days_num || Math.round((moonB.period_days || 28) * 1000),
      period_days_den: moonB.period_days_den || 1000,
      initial_phase_bp: moonB.initial_phase_bp ?? Math.round(((moonB.initial_phase || 0) * 10000) % 10000),
    };
    return defaultEngine.find_next_double_full_moon(wasmMoonA, wasmMoonB, ticksPerDay, startTAbs, maxSearchDays);
  };

  const calculateAllMoonPhases = (
    moons: MoonConfig[],
    worldDayOrTAbs: number,
    ticksPerDay: number = 1440
  ): MoonDayPhase[] => {
    const wasmMoons: WasmMoonConfig[] = (moons || []).map((m: MoonConfig) => ({
      name: m.name,
      period_days_num: m.period_days_num || Math.round((m.period_days || 28) * 1000),
      period_days_den: m.period_days_den || 1000,
      initial_phase_bp: m.initial_phase_bp ?? Math.round(((m.initial_phase || 0) * 10000) % 10000),
    }));
    return defaultEngine.calculate_all_moon_phases(worldDayOrTAbs, ticksPerDay, wasmMoons);
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
    tropicalYearNumOrDays: number = 3652425,
    tropicalYearDen: number = 10000
  ): CalendarAuditReport => {
    let num = tropicalYearNumOrDays;
    let den = tropicalYearDen;
    if (tropicalYearDen === undefined || tropicalYearNumOrDays < 1000) {
      num = Math.round(tropicalYearNumOrDays * 10000);
      den = 10000;
    }
    return defaultEngine.audit_calendar_culture(config, num, den);
  };

  const calculateLinkedAnchorWorldDay = (
    masterDate: DateCoordinate,
    masterConfig: WasmCultureConfig,
    localDate: DateCoordinate,
    localConfig: WasmCultureConfig
  ): number => {
    return defaultEngine.calculate_linked_anchor_world_day(masterDate, masterConfig, localDate, localConfig);
  };

  const dateToTAbs = (coord: DateCoordinate, config: WasmCultureConfig): bigint => {
    return defaultEngine.date_to_t_abs(coord, config);
  };

  const tAbsToDate = (tAbs: bigint | number, config: WasmCultureConfig): DateCoordinate => {
    return defaultEngine.t_abs_to_date(tAbs, config);
  };

  const getMonthGridBundle = (params: MonthGridParams): MonthGridBundle => {
    return defaultEngine.get_month_grid_bundle(params);
  };

  const intervalsOverlap = (s1: number, e1: number, s2: number, e2: number): boolean => {
    return defaultEngine.intervals_overlap(s1, e1, s2, e2);
  };

  const checkBilocation = (
    s1: number,
    e1: number,
    loc1: string,
    s2: number,
    e2: number,
    loc2: string
  ): boolean => {
    return defaultEngine.check_bilocation(s1, e1, loc1, s2, e2, loc2);
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
