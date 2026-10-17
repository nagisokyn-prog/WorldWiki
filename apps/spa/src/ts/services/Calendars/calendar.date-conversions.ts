import { defaultWasmEngine } from './calendar.wasm-bridge';
import type {
  CalendarData,
  CalendarDate,
  SyncAnchorDate,
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

export const CalendarDateConversions = {
  isLeapYear(cal: CalendarData, year: number): boolean {
    if (!cal) return false;
    const rule = cal.правило_високосного_года;
    if (rule === 'нет') return false;
    if (rule === 'каждый 4 год') {
      return defaultWasmEngine.is_leap_year(BigInt(year), [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }], 0);
    }
    if (rule === 'григорианский' || rule === 'григорианское' || !rule) {
      return defaultWasmEngine.is_leap_year(BigInt(year), [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ], 0);
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

    let totalDays = Number(defaultWasmEngine.days_up_to_year(BigInt(y), BigInt(baseDays), harmonics, BigInt(leapOffset)));
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

    const yearRes = defaultWasmEngine.year_from_days(BigInt(dayIndex), BigInt(baseDays), harmonics, BigInt(leapOffset));
    const year = typeof yearRes === 'object' && yearRes !== null && 'year' in yearRes ? Number((yearRes as { year: number }).year) : Number(yearRes);
    const yearStartDay = Number(defaultWasmEngine.days_up_to_year(BigInt(year), BigInt(baseDays), harmonics, BigInt(leapOffset)));
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
      minute,
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
    const offsetMins = this.getAnchorOffset(localCal, masterCal);
    const hInDay = localCal.настройки_времени?.часов_в_сутках || 24;
    const mInHour = localCal.настройки_времени?.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;
    const days = Math.floor(Math.abs(offsetMins) / minsInDay);
    const remMins = Math.abs(offsetMins) % minsInDay;
    const hours = Math.floor(remMins / mInHour);
    const sign = offsetMins >= 0 ? '+' : '-';
    return `Смещение относительно Календаря Мира: ${sign}${days} дн. ${hours} ч.`;
  },
};
