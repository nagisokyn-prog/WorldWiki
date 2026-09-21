/**
 * @file calendar.math.ts
 * @description Фасад математики календарей (O(1) расчеты, лунные фазы, синхронизация)
 */

import type {
  CalendarData,
  CalendarDate,
  MoonConfig,
  MoonPhaseResult,
  DaylightResult,
  LoreDateExplanation,
  WorldMoment,
  WorldTimezone,
  WorldRegion,
  RegionSunStatus
} from './calendar.types';
import { CalendarCycles } from './calendar.cycles';
import { CalendarLunar } from './calendar.lunar';
import { CalendarSync } from './calendar.sync';
import { CalendarFormat } from './calendar.format';

export class CalendarMath {
  public static isLeapYear(calendar: CalendarData, year: number): boolean {
    return CalendarCycles.isLeapYear(calendar, year);
  }

  public static getBaseDaysInYear(calendar: CalendarData): number {
    return CalendarCycles.getBaseDaysInYear(calendar);
  }

  public static countLeapYearsUpTo(calendar: CalendarData, y: number): number {
    return CalendarCycles.countLeapYearsUpTo(calendar, y);
  }

  public static getDaysUpToYear(calendar: CalendarData, year: number): number {
    return CalendarCycles.getDaysUpToYear(calendar, year);
  }

  public static getDaysInYear(calendar: CalendarData, year: number): number {
    return CalendarCycles.getDaysInYear(calendar, year);
  }

  public static getDaysInMonth(calendar: CalendarData, year: number, monthIndex: number): number {
    return CalendarCycles.getDaysInMonth(calendar, year, monthIndex);
  }

  public static getTotalDays(input: CalendarDate['original_input'], calendar: CalendarData): number {
    return CalendarCycles.getTotalDays(input, calendar);
  }

  public static getDateFromTotalDays(
    totalDays: number,
    calendar: CalendarData,
    era_index: number = 0
  ): { era_index: number; year: number; month: number; day: number } {
    return CalendarCycles.getDateFromTotalDays(totalDays, calendar, era_index);
  }

  /**
   * Convert Date Object to Absolute Minute (O(1))
   */
  public static getAbsoluteMinute(input: CalendarDate['original_input'], calendar: CalendarData): number {
    const era_index = Number(input.era_index) || 0;
    const year = Number(input.year) || 1;
    const month = Number(input.month) || 0;
    const day = Number(input.day) || 1;
    const hour = Number(input.hour) || 0;
    const minute = Number(input.minute) || 0;
    const settings = calendar?.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 0,
      учитывать_сезонную_длительность_дня: false
    };

    const hInDay = Number(settings.часов_в_сутках) || 24;
    const mInHour = Number(settings.минут_в_часе) || 60;
    const minutesInDay = Math.max(1, hInDay * mInHour);

    const era = calendar?.эпохи ? calendar.эпохи[era_index] : undefined;
    const isReverse = era?.обратный_отсчет;
    const actualYear = isReverse ? -year : year;

    let totalDays = this.getDaysUpToYear(calendar, actualYear);

    const months = calendar?.месяцы || [];
    for (let m = 0; m < month && m < months.length; m++) {
      totalDays += this.getDaysInMonth(calendar, actualYear, m);
    }

    totalDays += (day - 1);

    let absMinute = totalDays * minutesInDay;
    absMinute += hour * mInHour;
    absMinute += minute;

    return absMinute;
  }

  /**
   * Convert Absolute Minute to Date Object (O(1))
   */
  public static getDateFromAbsolute(
    absoluteMinute: number,
    calendar: CalendarData,
    era_index?: number
  ): CalendarDate['original_input'] {
    const safeAbsMin = Number(absoluteMinute) || 0;
    const settings = calendar?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = Number(settings.часов_в_сутках) || 24;
    const mInHour = Number(settings.минут_в_часе) || 60;
    const minutesInDay = Math.max(1, hInDay * mInHour);

    let totalDays = Math.floor(safeAbsMin / minutesInDay);
    const remainderMinutes = safeAbsMin - totalDays * minutesInDay;

    const hour = Math.floor(remainderMinutes / mInHour);
    const minute = remainderMinutes % mInHour;

    const baseDays = this.getBaseDaysInYear(calendar);
    let year = Math.floor(totalDays / (baseDays || 365)) + 1;
    let daysAtYear = this.getDaysUpToYear(calendar, year);

    while (daysAtYear > totalDays) {
      year--;
      daysAtYear = this.getDaysUpToYear(calendar, year);
    }
    while (totalDays - daysAtYear >= this.getDaysInYear(calendar, year)) {
      daysAtYear += this.getDaysInYear(calendar, year);
      year++;
    }

    totalDays -= daysAtYear;

    let month = 0;
    const months = calendar?.месяцы || [];
    for (let m = 0; m < months.length; m++) {
      const mDays = this.getDaysInMonth(calendar, year, m);
      if (totalDays >= mDays) {
        totalDays -= mDays;
        month++;
      } else {
        break;
      }
    }

    const day = totalDays + 1;

    let matchedEraIndex = 0;
    const eras = calendar?.эпохи || [];
    if (era_index !== undefined && era_index >= 0 && era_index < eras.length) {
      matchedEraIndex = era_index;
    } else if (eras.length > 0) {
      const foundIdx = eras.findIndex(e => year >= e.год_начала && year <= e.год_конца);
      matchedEraIndex = foundIdx !== -1 ? foundIdx : 0;
    }

    const era = eras[matchedEraIndex];
    let displayYear = year;
    if (era?.обратный_отсчет) {
      displayYear = -year;
    }

    return {
      era_index: matchedEraIndex,
      year: displayYear <= 0 ? Math.abs(displayYear) || 1 : displayYear,
      month,
      day,
      hour,
      minute
    };
  }

  public static calculateMoonPhases(
    absoluteMinute: number,
    moons: MoonConfig[] = [],
    calendar: CalendarData
  ): MoonPhaseResult[] {
    return CalendarLunar.calculateMoonPhases(absoluteMinute, moons, calendar);
  }

  public static calculateDaylight(absoluteMinute: number, calendar: CalendarData): DaylightResult | null {
    return CalendarLunar.calculateDaylight(absoluteMinute, calendar);
  }

  public static formatDaylightLiterary(
    daylight: DaylightResult | null
  ): { duration: string; sunrise: string; sunset: string } | null {
    return CalendarLunar.formatDaylightLiterary(daylight);
  }

  public static getTimezoneOffsetForDay(timezone: WorldTimezone, worldDay: number): number {
    return CalendarLunar.getTimezoneOffsetForDay(timezone, worldDay);
  }

  public static calculateSunForRegion(
    region: WorldRegion,
    moment: WorldMoment,
    calendar: CalendarData,
    timezones: WorldTimezone[] = []
  ): RegionSunStatus {
    return CalendarLunar.calculateSunForRegion(region, moment, calendar, timezones);
  }

  public static parseDurationString(input: string, calendar: CalendarData): number {
    return CalendarFormat.parseDurationString(input, calendar, (c, y) => this.getDaysInYear(c, y));
  }

  public static isHoliday(calendar: CalendarData, year: number, monthIdx: number, day: number): boolean {
    return CalendarFormat.isHoliday(calendar, year, monthIdx, day);
  }

  public static getSeasonForDate(calendar: CalendarData, year: number, monthIdx: number): string {
    return CalendarFormat.getSeasonForDate(calendar, year, monthIdx);
  }

  public static formatDate(calendar: CalendarData, dateObj: CalendarDate): string {
    return CalendarFormat.formatDate(calendar, dateObj);
  }

  public static getDefaultCalendar(): CalendarData {
    return CalendarFormat.getDefaultCalendar();
  }

  public static getMonthName(calendar: CalendarData, monthIndex: number): string {
    return calendar.месяцы[monthIndex]?.название || 'Неизвестный месяц';
  }

  public static getDayName(calendar: CalendarData, dayIndex: number): string {
    return calendar.названия_дней_недели[dayIndex] || 'День';
  }

  public static mergeCalendarData(target: CalendarData, source: Partial<CalendarData>): CalendarData {
    return CalendarFormat.mergeCalendarData(target, source);
  }

  public static getAnchorOffset(localCal: CalendarData, masterCal?: CalendarData | null): number {
    return CalendarSync.getAnchorOffset(localCal, masterCal, (inp, cal) => this.getAbsoluteMinute(inp, cal));
  }

  public static localDateToMasterMinute(
    date: CalendarDate['original_input'],
    localCal: CalendarData,
    masterCal?: CalendarData | null
  ): number {
    const localMin = this.getAbsoluteMinute(date, localCal);
    const offset = this.getAnchorOffset(localCal, masterCal);
    return localMin + offset;
  }

  public static masterMinuteToLocalDate(
    masterMinute: number,
    localCal: CalendarData,
    masterCal?: CalendarData | null,
    era_index: number = 0
  ): CalendarDate['original_input'] {
    const offset = this.getAnchorOffset(localCal, masterCal);
    const localMin = masterMinute - offset;
    return this.getDateFromAbsolute(localMin, localCal, era_index);
  }

  public static convertDateBetweenCalendars(
    date: CalendarDate['original_input'],
    fromCal: CalendarData,
    toCal: CalendarData,
    masterCal?: CalendarData | null,
    to_era_index: number = 0
  ): CalendarDate['original_input'] {
    if (fromCal === toCal || fromCal._id && fromCal._id === toCal._id) {
      return { ...date };
    }
    const masterMin = this.localDateToMasterMinute(date, fromCal, masterCal);
    return this.masterMinuteToLocalDate(masterMin, toCal, masterCal, to_era_index);
  }

  public static formatAnchorOffsetDescription(localCal: CalendarData, masterCal?: CalendarData | null): string {
    return CalendarSync.formatAnchorOffsetDescription(localCal, masterCal, (lc, mc) => this.getAnchorOffset(lc, mc));
  }

  public static dateToWorldMoment(
    date: CalendarDate['original_input'],
    calendar: CalendarData,
    offsetHours: number = 0,
    masterCal?: CalendarData | null
  ): WorldMoment {
    return CalendarSync.dateToWorldMoment(date, calendar, offsetHours, masterCal, (lc, mc) => this.getAnchorOffset(lc, mc));
  }

  public static worldMomentToDate(
    moment: WorldMoment,
    calendar: CalendarData,
    offsetHours: number = 0,
    masterCal?: CalendarData | null,
    era_index: number = 0
  ): CalendarDate['original_input'] {
    return CalendarSync.worldMomentToDate(moment, calendar, offsetHours, masterCal, era_index, (lc, mc) => this.getAnchorOffset(lc, mc));
  }

  public static explainDate(
    date: CalendarDate['original_input'],
    activeCal: CalendarData,
    allCalendars: CalendarData[],
    masterCal?: CalendarData | null
  ): LoreDateExplanation {
    const effectiveMaster = masterCal || allCalendars.find(c => c.is_master) || activeCal;
    const masterMin = this.localDateToMasterMinute(date, activeCal, effectiveMaster);
    
    const masterDateObj = this.getDateFromAbsolute(masterMin, effectiveMaster, 0);
    const masterFormatted = this.formatDate(effectiveMaster, {
      absolute_minute: masterMin,
      calendar_id: effectiveMaster._id || '',
      original_input: masterDateObj
    });

    const localFormatted = this.formatDate(activeCal, {
      absolute_minute: masterMin,
      calendar_id: activeCal._id || '',
      original_input: date
    });

    const crossDates: Array<{ calendarName: string; formatted: string }> = [];
    for (const cal of allCalendars) {
      if (cal === activeCal || (cal._id && cal._id === activeCal._id)) continue;
      const otherDate = this.masterMinuteToLocalDate(masterMin, cal, effectiveMaster, 0);
      crossDates.push({
        calendarName: cal.название || 'Календарь',
        formatted: this.formatDate(cal, {
          absolute_minute: masterMin,
          calendar_id: cal._id || '',
          original_input: otherDate
        }),
      });
    }

    const moons = this.calculateMoonPhases(masterMin, effectiveMaster.moons || activeCal.moons || [], effectiveMaster);
    const daylight = this.calculateDaylight(masterMin, effectiveMaster);
    const daylightInfo = this.formatDaylightLiterary(daylight);

    const holidays: string[] = [];
    if (activeCal.праздники) {
      for (const h of activeCal.праздники) {
        if (this.isHoliday(activeCal, date.year, date.month, date.day)) {
          holidays.push(`${h.название} (${activeCal.название})`);
        }
      }
    }
    if (effectiveMaster !== activeCal && effectiveMaster.праздники) {
      for (const h of effectiveMaster.праздники) {
        if (this.isHoliday(effectiveMaster, masterDateObj.year, masterDateObj.month, masterDateObj.day)) {
          holidays.push(`${h.название} (${effectiveMaster.название})`);
        }
      }
    }

    let snippet = `${localFormatted}`;
    if (effectiveMaster !== activeCal) {
      snippet += ` (по Календарю Мира: ${masterFormatted})`;
    }
    const fullMoon = moons.find(m => m.name === 'Полнолуние' || m.emoji === '🌕');
    if (fullMoon) {
      snippet += `, в полнолуние ${fullMoon.moon.name}`;
    }

    return {
      masterDateFormatted: masterFormatted,
      localDateFormatted: localFormatted,
      crossDates,
      moons,
      daylightText: daylightInfo?.duration,
      sunriseText: daylightInfo?.sunrise,
      sunsetText: daylightInfo?.sunset,
      holidays: Array.from(new Set(holidays)),
      snippet,
    };
  }
}
