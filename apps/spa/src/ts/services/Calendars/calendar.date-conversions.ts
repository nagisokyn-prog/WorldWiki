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
    if (rule === 'нет' || rule === 'отсутствует') return false;
    try {
      if (rule === 'каждый 4 год') {
        return defaultWasmEngine.is_leap_year(BigInt(year), [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }], 0);
      }
      if (rule === 'пользовательское') {
        if (cal.високосные_правила && cal.високосные_правила.length > 0) {
          return defaultWasmEngine.is_leap_year(BigInt(year), cal.високосные_правила, 0);
        }
        const period = cal.пользовательское_високосное_правило?.период || 4;
        return defaultWasmEngine.is_leap_year(BigInt(year), [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: period }], 0);
      }
      if (rule === 'григорианский' || rule === 'григорианское' || !rule) {
        return defaultWasmEngine.is_leap_year(BigInt(year), [
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
          { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
        ], 0);
      }
    } catch {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }
    return false;
  },

  getBaseDaysInYear(cal: CalendarData): number {
    if (!cal) return 365;
    const monthsDays = cal.месяцы ? cal.месяцы.reduce((acc, m) => acc + (m.дней || 0), 0) : 365;
    const extra = cal.extra_days_config?.base_days ?? cal.extra_days ?? cal.epagomenal_config?.extra_days_base ?? 0;
    return monthsDays + extra;
  },

  getDaysInYear(cal: CalendarData, year: number): number {
    const base = this.getBaseDaysInYear(cal);
    if (this.isLeapYear(cal, year)) {
      const targetMode = cal.extra_days_config?.target_mode;
      const leapDays = targetMode === 'in_extra_days'
        ? (cal.extra_days_config?.leap_days ?? cal.epagomenal_config?.extra_days_leap ?? 1)
        : (cal.пользовательское_високосное_правило?.день_смещения ?? 1);
      return base + leapDays;
    }
    return base;
  },

  getDaysInMonth(cal: CalendarData, year: number, monthIdx: number): number {
    if (!cal || !cal.месяцы || monthIdx < 0 || monthIdx >= cal.месяцы.length) {
      return 30;
    }
    let days = cal.месяцы[monthIdx]?.дней || 30;
    const isLeap = this.isLeapYear(cal, year);
    const targetMode = cal.extra_days_config?.target_mode ?? 'in_month';
    if (isLeap && targetMode === 'in_month') {
      const custom = cal.пользовательское_високосное_правило;
      const targetMonth = cal.extra_days_config?.target_month_index ?? custom?.месяц ?? 1;
      if (targetMonth === monthIdx) {
        days += custom?.день_смещения ?? cal.extra_days_config?.leap_days ?? 1;
      }
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

    const eraIdx = Number(raw?.era_index ?? 0);
    const era = cal.эпохи?.[eraIdx];
    const y = Number(raw?.year ?? 1);
    const m = Number(raw?.month ?? 0);
    const d = Number(raw?.day ?? 1);
    const h = Number(raw?.hour ?? 0);
    const min = Number(raw?.minute ?? 0);

    const isReverse = !!era?.обратный_отсчет || y < 0;
    const effectiveY = Math.abs(y);

    const baseDays = this.getBaseDaysInYear(cal);
    const harmonics = (cal.правило_високосного_года === 'каждый 4 год')
      ? [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }]
      : [
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
          { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
        ];
    const leapOffset = cal.пользовательское_високосное_правило?.день_смещения ?? 1;

    let totalDays: number;
    try {
      totalDays = Number(defaultWasmEngine.days_up_to_year(BigInt(effectiveY), BigInt(baseDays), harmonics, BigInt(leapOffset)));
      if (isNaN(totalDays)) throw new Error('NaN totalDays');
    } catch {
      totalDays = Math.max(0, effectiveY - 1) * baseDays;
    }
    for (let mi = 0; mi < m; mi++) {
      totalDays += this.getDaysInMonth(cal, effectiveY, mi);
    }
    totalDays += (d - 1);

    const forwardMin = totalDays * minsInDay + h * mInHour + min;
    return isReverse ? -forwardMin : forwardMin;
  },

  getDateFromAbsolute(absMin: number, cal: CalendarData, eraIndex: number = 0): SyncAnchorDate {
    if (!cal) return { year: 1, month: 0, day: 1, hour: 0, minute: 0, era_index: 0 };
    const era = cal.эпохи?.[eraIndex];
    const isReverse = !!era?.обратный_отсчет;
    const effectiveAbsMin = isReverse ? Math.abs(absMin) : absMin;

    const settings = cal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const minsInDay = hInDay * mInHour;

    const dayIndex = Math.floor(effectiveAbsMin / minsInDay);
    const remMin = ((effectiveAbsMin % minsInDay) + minsInDay) % minsInDay;
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

    let rawYear: number;
    let yearStartDay: number;
    try {
      const yearRes = defaultWasmEngine.year_from_days(BigInt(dayIndex), BigInt(baseDays), harmonics, BigInt(leapOffset));
      rawYear = typeof yearRes === 'object' && yearRes !== null && 'year' in yearRes ? Number((yearRes as { year: number }).year) : Number(yearRes);
      if (isNaN(rawYear)) throw new Error('NaN year');
      yearStartDay = Number(defaultWasmEngine.days_up_to_year(BigInt(rawYear), BigInt(baseDays), harmonics, BigInt(leapOffset)));
      if (isNaN(yearStartDay)) throw new Error('NaN yearStartDay');
    } catch {
      rawYear = Math.floor(dayIndex / Math.max(1, baseDays)) + 1;
      yearStartDay = Math.max(0, rawYear - 1) * baseDays;
    }
    const year = isReverse ? Math.abs(rawYear) : rawYear;
    let dayInYear = Math.max(0, dayIndex - yearStartDay);

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

    const direction = offsetMins < 0 ? 'раньше Календаря Мира' : 'позже Календаря Мира';
    const baseDays = this.getBaseDaysInYear(localCal) || 365;
    const years = Math.floor(days / baseDays);
    const remDays = days % baseDays;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} г.`);
    if (remDays > 0) parts.push(`${remDays} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (parts.length === 0) parts.push('0 дн.');

    return `Точка отсчета на ${parts.join(' ')} ${direction}.`;
  },
};
