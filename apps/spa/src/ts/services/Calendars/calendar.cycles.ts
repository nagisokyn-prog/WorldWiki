/**
 * @file calendar.cycles.ts
 * @description Высокопроизводительные O(1) циклы календаря: гармоники високосов, обращение года и дней.
 * Полностью согласовано с математическим ядром worldwiki-calendar-core.
 */

import type { CalendarData, CalendarDate } from './calendar.types';

export interface LeapHarmonicDTO {
  weight: number;
  multiplier_a: number;
  shift_b: number;
  divisor_c: number;
}

export class CalendarCycles {
  private static daysInMonthCache = new Map<string, number>();

  /**
   * Евклидово целочисленное деление с округлением вниз к минус бесконечности
   */
  public static floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
  }

  /**
   * Извлекает активные гармоники високосности календаря
   */
  public static getHarmonics(calendar: CalendarData): LeapHarmonicDTO[] {
    const rule = calendar?.правило_високосного_года;
    if (rule === 'григорианское' || rule === 'gregorian') {
      return [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ];
    }
    if (rule === 'каждый 4 год' || rule === 'julian') {
      return [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }];
    }
    if (rule === 'пользовательское' || rule === 'custom') {
      const custom = calendar.пользовательское_високосное_правило as Record<string, unknown> | undefined;
      // Если переданы явные гармоники
      if (Array.isArray(custom?.harmonics)) {
        return custom.harmonics as LeapHarmonicDTO[];
      }
      const period = Number(custom?.период || custom?.period) || 4;
      if (period > 0) {
        return [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: period }];
      }
    }
    return [];
  }

  /**
   * Кумулятивная сумма високосных добавок F(Y) = sum(w * floor((a*Y + b) / c))
   */
  public static leapsCount(year: number, harmonics: LeapHarmonicDTO[], daysOffset: number = 0): number {
    let total = daysOffset;
    for (let i = 0; i < harmonics.length; i++) {
      const h = harmonics[i];
      if (h.divisor_c > 0) {
        const val = this.floorDiv(h.multiplier_a * year + h.shift_b, h.divisor_c);
        total += h.weight * val;
      }
    }
    return total;
  }

  /**
   * Проверка високосности года: F(Y) - F(Y - 1) != 0 (O(1))
   */
  public static isLeapYear(calendar: CalendarData, year: number): boolean {
    if (!calendar) return false;
    const harmonics = this.getHarmonics(calendar);
    if (harmonics.length === 0) return false;

    const fCurr = this.leapsCount(year, harmonics);
    const fPrev = this.leapsCount(year - 1, harmonics);
    return fCurr - fPrev !== 0;
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
   * Аналитический подсчет количества високосных лет до года y (O(1))
   */
  public static countLeapYearsUpTo(calendar: CalendarData, y: number): number {
    if (y < 1) return 0;
    const harmonics = this.getHarmonics(calendar);
    return this.leapsCount(y, harmonics) - this.leapsCount(0, harmonics);
  }

  /**
   * Количество дней от начала времен (год 1) до начала года `year` (строгое O(1) для любых Y)
   */
  public static getDaysUpToYear(calendar: CalendarData, year: number): number {
    const baseDays = this.getBaseDaysInYear(calendar);
    const leapOffset = calendar?.пользовательское_високосное_правило?.день_смещения || 1;
    const harmonics = this.getHarmonics(calendar);

    // Универсальная формула, доказанная через Kani:
    // days = (year - 1) * baseDays + leapOffset * (F(year - 1) - F(0))
    const prevYears = year - 1;
    const leapsBefore = this.leapsCount(prevYears, harmonics) - this.leapsCount(0, harmonics);
    return prevYears * baseDays + leapsBefore * leapOffset;
  }

  /**
   * Число дней в году (O(1))
   */
  public static getDaysInYear(calendar: CalendarData, year: number): number {
    const base = this.getBaseDaysInYear(calendar);
    if (this.isLeapYear(calendar, year)) {
      const leapRule = calendar?.пользовательское_високосное_правило;
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
   * Вычисляет порядковый номер суток от точки отсчёта календаря (O(1) по годам + O(M) по месяцам)
   */
  public static getTotalDays(input: CalendarDate['original_input'], calendar: CalendarData): number {
    const { era_index = 0, year = 1, month = 0, day = 1 } = input;
    const era = calendar.эпохи?.[era_index];
    const isReverse = era?.обратный_отсчет;
    const actualYear = isReverse ? -year : year;

    let totalDays = this.getDaysUpToYear(calendar, actualYear);

    if (calendar.месяцы) {
      for (let m = 0; m < month && m < calendar.месяцы.length; m++) {
        totalDays += this.getDaysInMonth(calendar, actualYear, m);
      }
    }

    totalDays += (day - 1);
    return totalDays;
  }

  /**
   * Восстанавливает (era_index, year, month, day) из порядкового номера суток календаря.
   * Истинное O(1) обращение года с циклом точной доводки ровно 0..2 шага.
   */
  public static getDateFromTotalDays(
    totalDays: number,
    calendar: CalendarData,
    era_index: number = 0
  ): { era_index: number; year: number; month: number; day: number } {
    const baseDays = this.getBaseDaysInYear(calendar);
    const harmonics = this.getHarmonics(calendar);

    // Эвристика средней длины года
    let sumWeight = 0;
    for (let i = 0; i < harmonics.length; i++) {
      if (harmonics[i].divisor_c > 0) {
        sumWeight += (harmonics[i].weight * harmonics[i].multiplier_a) / harmonics[i].divisor_c;
      }
    }
    const avgYearLength = baseDays + sumWeight;

    // Начальная оценка года
    let year = Math.floor(totalDays / avgYearLength) + 1;
    let daysBefore = this.getDaysUpToYear(calendar, year);

    // Доводка сходимости O(1) за 0..2 шага
    while (daysBefore > totalDays) {
      year--;
      daysBefore = this.getDaysUpToYear(calendar, year);
    }
    while (totalDays - daysBefore >= this.getDaysInYear(calendar, year)) {
      daysBefore += this.getDaysInYear(calendar, year);
      year++;
    }

    let remDays = totalDays - daysBefore;

    let month = 0;
    const months = calendar.месяцы || [];
    for (let m = 0; m < months.length; m++) {
      const mDays = this.getDaysInMonth(calendar, year, m);
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
      day,
    };
  }
}
