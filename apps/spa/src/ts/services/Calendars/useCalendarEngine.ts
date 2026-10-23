/**
 * @file useCalendarEngine.ts
 * @description Единый реактивный фасад математического ядра календаря для Vue 3.
 * Работает поверх `@worldwiki/calendar-wasm` с O(1) алгоритмами и целочисленной точностью.
 */

import {
  CalendarWasmBridge,
  defaultWasmEngine,
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
  type MoonDayPhase,
  type MoonPhaseName,
  type WasmAgeParams,
  type WasmCultureConfig,
  type WasmWeekdayPauseParams,
  type YearPreview,
} from './calendar.wasm-bridge';
import { CalendarAstronomy } from './calendar.astronomy';
import {
  CalendarDateConversions,
  type CalendarDateParts,
  type CalendarDateInput,
} from './calendar.date-conversions';
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

export type { CalendarDateParts, CalendarDateInput };

export const CalendarEngine = {
  getEngine() {
    return defaultWasmEngine;
  },

  getDefaultCalendar(): CalendarData {
    return CalendarFormat.getDefaultCalendar();
  },

  isLeapYear(cal: CalendarData, year: number): boolean {
    return CalendarDateConversions.isLeapYear(cal, year);
  },

  getBaseDaysInYear(cal: CalendarData): number {
    return CalendarDateConversions.getBaseDaysInYear(cal);
  },

  getDaysInYear(cal: CalendarData, year: number): number {
    return CalendarDateConversions.getDaysInYear(cal, year);
  },

  getDaysInMonth(cal: CalendarData, year: number, monthIdx: number): number {
    return CalendarDateConversions.getDaysInMonth(cal, year, monthIdx);
  },

  getAbsoluteMinute(date: CalendarDateInput, cal: CalendarData): number {
    return CalendarDateConversions.getAbsoluteMinute(date, cal);
  },

  getDateFromAbsolute(absMin: number, cal: CalendarData, eraIndex: number = 0): SyncAnchorDate {
    return CalendarDateConversions.getDateFromAbsolute(absMin, cal, eraIndex);
  },

  getAnchorOffset(localCal?: CalendarData | null, masterCal?: CalendarData | null): number {
    return CalendarDateConversions.getAnchorOffset(localCal, masterCal);
  },

  localDateToMasterMinute(date: CalendarDateInput, localCal?: CalendarData | null, masterCal?: CalendarData | null): number {
    return CalendarDateConversions.localDateToMasterMinute(date, localCal, masterCal);
  },

  masterMinuteToLocalDate(masterMin: number, localCal?: CalendarData | null, masterCal?: CalendarData | null, eraIndex: number = 0): SyncAnchorDate {
    return CalendarDateConversions.masterMinuteToLocalDate(masterMin, localCal, masterCal, eraIndex);
  },

  convertDateBetweenCalendars(
    date: CalendarDateInput,
    sourceCal?: CalendarData | null,
    targetCal?: CalendarData | null,
    masterCal?: CalendarData | null,
    eraIndex: number = 0
  ): SyncAnchorDate {
    return CalendarDateConversions.convertDateBetweenCalendars(date, sourceCal, targetCal, masterCal, eraIndex);
  },

  formatAnchorOffsetDescription(localCal?: CalendarData | null, masterCal?: CalendarData | null): string {
    return CalendarDateConversions.formatAnchorOffsetDescription(localCal, masterCal);
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

  mergeCalendarData(target: CalendarData, source: Partial<CalendarData>): CalendarData {
    const baseSettings = target.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 0,
      учитывать_сезонную_длительность_дня: false,
    };
    return {
      ...target,
      ...source,
      настройки_времени: {
        ...baseSettings,
        ...(source.настройки_времени || {}),
      },
    };
  },

  getMonthName(cal: CalendarData, idx: number): string {
    return (cal.месяцы && cal.месяцы[idx]?.название) ? cal.месяцы[idx].название : 'Неизвестный месяц';
  },

  getDayName(cal: CalendarData, idx: number): string {
    return (cal.названия_дней_недели && cal.названия_дней_недели[idx]) ? cal.названия_дней_недели[idx] : 'День';
  },

  getSeasonForDate(calendar: CalendarData, year: number, monthIdx: number): string {
    return CalendarFormat.getSeasonForDate(calendar, year, monthIdx);
  },

  isHoliday(calendar: CalendarData, year: number, monthIdx: number, day: number): boolean {
    return CalendarFormat.isHoliday(calendar, year, monthIdx, day);
  },

  calculateDaylight(absMin: number, cal: CalendarData): DaylightResult | null {
    return CalendarAstronomy.calculateDaylight(absMin, cal, (c, y) => this.getDaysInYear(c, y));
  },

  formatDaylightLiterary(daylight?: DaylightResult | null): { duration: string; sunrise: string; sunset: string } | null {
    return CalendarAstronomy.formatDaylightLiterary(daylight);
  },

  calculateMoonPhases(absMin: number, moons: MoonConfig[], cal?: CalendarData): MoonPhaseResult[] {
    return CalendarAstronomy.calculateMoonPhases(absMin, moons, cal);
  },

  getTimezoneOffsetForDay(tz: WorldTimezone, dayIndex: number): number {
    return CalendarAstronomy.getTimezoneOffsetForDay(tz, dayIndex);
  },

  dateToWorldMoment(date: CalendarDateInput, cal: CalendarData, offsetHours: number = 0): WorldMoment {
    return CalendarAstronomy.dateToWorldMoment(date, cal, (d, c) => this.getAbsoluteMinute(d, c), offsetHours);
  },

  worldMomentToDate(moment: WorldMoment, cal: CalendarData, offsetHours: number = 0): SyncAnchorDate {
    return CalendarAstronomy.worldMomentToDate(moment, cal, (m, c, e) => this.getDateFromAbsolute(m, c, e), offsetHours);
  },

  calculateSunForRegion(
    region: WorldRegion,
    moment: WorldMoment,
    cal: CalendarData,
    _timezones?: WorldTimezone[]
  ): RegionSunStatus {
    return CalendarAstronomy.calculateSunForRegion(region, moment, cal, (m, c) => this.calculateDaylight(m, c));
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
    return CalendarAstronomy.explainDate(date, cal, allCals, masterCal, {
      formatDate: (c, d) => this.formatDate(c, d),
      localDateToMasterMinute: (d, l, m) => this.localDateToMasterMinute(d, l, m),
      getDateFromAbsolute: (m, c, e) => this.getDateFromAbsolute(m, c, e),
      masterMinuteToLocalDate: (m, l, mc, e) => this.masterMinuteToLocalDate(m, l, mc, e),
      calculateDaylight: (m, c) => this.calculateDaylight(m, c),
      getSeasonForDate: (c, y, m) => this.getSeasonForDate(c, y, m),
      isHoliday: (c, y, m, d) => this.isHoliday(c, y, m, d),
    });
  }
};

export const CalendarMath = CalendarEngine;

export function useCalendarEngine() {
  return {
    ...CalendarEngine,
    ...CalendarWasmBridge,
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
