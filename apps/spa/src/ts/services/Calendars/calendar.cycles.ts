import type { CalendarData, CalendarDate } from './calendar.types';

export class CalendarCycles {
  private static daysInMonthCache = new Map<string, number>();

  /**
   * Helper: check leap year (O(1))
   */
  public static isLeapYear(calendar: CalendarData, year: number): boolean {
    if (!calendar) return false;
    const rule = calendar.правило_високосного_года;
    if (rule === 'григорианское') {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }
    if (rule === 'каждый 4 год') {
      return year % 4 === 0;
    }
    if (rule === 'пользовательское') {
      const step = (calendar.пользовательское_високосное_правило as Record<string, unknown>)?.период as number || 4;
      return step > 0 ? year % step === 0 : false;
    }
    return false;
  }

  /**
   * Сумма дней в невисокосном году (базовая сумма месяцев)
   */
  public static getBaseDaysInYear(calendar: CalendarData): number {
    if (!calendar || !calendar.месяцы || calendar.месяцы.length === 0) {
      return 365;
    }
    let sum = 0;
    for (let i = 0; i < calendar.месяцы.length; i++) {
      sum += calendar.месяцы[i]?.дней || 0;
    }
    return sum > 0 ? sum : 365;
  }

  /**
   * Аналитический подсчет количества високосных лет в диапазоне [1, Y] (O(1))
   */
  public static countLeapYearsUpTo(calendar: CalendarData, y: number): number {
    if (y < 1) return 0;
    const rule = calendar?.правило_високосного_года;
    if (rule === 'григорианское') {
      return Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
    }
    if (rule === 'каждый 4 год') {
      return Math.floor(y / 4);
    }
    if (rule === 'пользовательское') {
      const step = (calendar.пользовательское_високосное_правило as Record<string, unknown>)?.период as number || 4;
      return step > 0 ? Math.floor(y / step) : 0;
    }
    return 0;
  }

  /**
   * Количество дней от начала времен до начала года `year` (O(1))
   */
  public static getDaysUpToYear(calendar: CalendarData, year: number): number {
    const baseDays = this.getBaseDaysInYear(calendar);
    const leapOffset = calendar?.пользовательское_високосное_правило?.день_смещения || 1;

    if (year > 1) {
      const prevYears = year - 1;
      const leapCount = this.countLeapYearsUpTo(calendar, prevYears);
      return prevYears * baseDays + leapCount * leapOffset;
    } else if (year < 1) {
      const absYears = Math.abs(year);
      const leapCount = this.countLeapYearsUpTo(calendar, absYears);
      return -(absYears * baseDays + leapCount * leapOffset);
    }
    return 0;
  }

  /**
   * Get days in year (O(1))
   */
  public static getDaysInYear(calendar: CalendarData, year: number): number {
    const base = this.getBaseDaysInYear(calendar);
    if (this.isLeapYear(calendar, year)) {
      const leapRule = calendar.пользовательское_високосное_правило;
      return base + (leapRule?.день_смещения || 1);
    }
    return base;
  }

  /**
   * Получить количество дней в месяце с учётом високосности (с кэшированием)
   */
  public static getDaysInMonth(calendar: CalendarData, year: number, monthIndex: number): number {
    if (!calendar || !calendar.месяцы) return 30;
    const calKey = calendar._id || calendar.название || 'default';
    const cacheKey = `${calKey}:${year}:${monthIndex}`;
    const cached = this.daysInMonthCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const month = calendar.месяцы[monthIndex];
    if (!month) return 30;
    let days = month.дней;
    const leapRule = calendar.пользовательское_високосное_правило;
    const leapMonth = leapRule?.месяц;
    if (this.isLeapYear(calendar, year) && monthIndex === leapMonth) {
      days += leapRule?.день_смещения || 1;
    }
    
    if (this.daysInMonthCache.size > 5000) {
      this.daysInMonthCache.clear();
    }
    this.daysInMonthCache.set(cacheKey, days);
    return days;
  }

  /**
   * Вычисляет порядковый номер суток от точки отсчёта календаря
   */
  public static getTotalDays(input: CalendarDate['original_input'], calendar: CalendarData): number {
    const { era_index = 0, year = 1, month = 0, day = 1 } = input;
    let totalDays = 0;
    const era = calendar.эпохи?.[era_index];
    const isReverse = era?.обратный_отсчет;
    const actualYear = isReverse ? -year : year;

    if (actualYear > 1) {
      for (let y = 1; y < actualYear; y++) {
        totalDays += this.getDaysInYear(calendar, y);
      }
    } else if (actualYear < 1) {
      for (let y = 0; y >= actualYear; y--) {
        totalDays -= this.getDaysInYear(calendar, y);
      }
    }

    if (calendar.месяцы) {
      for (let m = 0; m < month && m < calendar.месяцы.length; m++) {
        let mDays = calendar.месяцы[m].дней;
        const leapRule = calendar.пользовательское_високосное_правило;
        if (leapRule && leapRule.месяц === m && this.isLeapYear(calendar, actualYear)) {
          mDays += leapRule.день_смещения;
        }
        totalDays += mDays;
      }
    }

    totalDays += (day - 1);
    return totalDays;
  }

  /**
   * Восстанавливает (era_index, year, month, day) из порядкового номера суток календаря
   */
  public static getDateFromTotalDays(
    totalDays: number,
    calendar: CalendarData,
    era_index: number = 0
  ): { era_index: number; year: number; month: number; day: number } {
    let remDays = totalDays;
    let year = 1;
    let safetyLimit = 500000;

    if (remDays >= 0) {
      while (safetyLimit-- > 0) {
        const dInY = Math.max(1, this.getDaysInYear(calendar, year));
        if (remDays < dInY) break;
        remDays -= dInY;
        year++;
      }
    } else {
      year = 0;
      while (safetyLimit-- > 0) {
        const dInY = Math.max(1, this.getDaysInYear(calendar, year));
        if (remDays >= -dInY) {
          remDays += dInY;
          break;
        }
        remDays += dInY;
        year--;
      }
    }

    let month = 0;
    const months = calendar.месяцы || [];
    for (let m = 0; m < months.length; m++) {
      let mDays = months[m]?.дней || 0;
      const leapRule = calendar.пользовательское_високосное_правило;
      if (leapRule && leapRule.месяц === m && this.isLeapYear(calendar, year)) {
        mDays += leapRule.день_смещения || 0;
      }
      if (remDays < mDays) {
        month = m;
        break;
      }
      remDays -= mDays;
      if (m === months.length - 1) {
        month = m;
      }
    }

    const day = remDays + 1;
    const era = calendar.эпохи?.[era_index];
    const isReverse = era?.обратный_отсчет;
    const displayYear = isReverse ? -year : year;

    return {
      era_index,
      year: displayYear <= 0 ? Math.abs(displayYear) || 1 : displayYear,
      month,
      day
    };
  }
}
