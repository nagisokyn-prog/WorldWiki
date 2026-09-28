import { CalendarMath } from '@/services/Calendars/calendar.math';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';

export function pluralize(num: number, one: string, two: string, five: string): string {
  const n = Math.abs(num) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}

export function formatFlashbackDelta(deltaMinutes: number): string {
  const years = Math.floor(deltaMinutes / (365 * 1440));
  if (years >= 1) {
    return `⏪ Флэшбек (на ${years} ${pluralize(years, 'год', 'года', 'лет')} назад)`;
  }
  const months = Math.floor(deltaMinutes / (30 * 1440));
  if (months >= 1) {
    return `⏪ Флэшбек (на ${months} ${pluralize(months, 'месяц', 'месяца', 'месяцев')} назад)`;
  }
  const days = Math.floor(deltaMinutes / 1440);
  if (days >= 1) {
    return `⏪ Флэшбек (на ${days} ${pluralize(days, 'день', 'дня', 'дней')} назад)`;
  }
  const hours = Math.floor(deltaMinutes / 60);
  if (hours >= 1) {
    return `⏪ Флэшбек (на ${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад)`;
  }
  return '⏪ Флэшбек';
}

export function computeMabsFromDateFields(
  dateFields: Record<string, unknown> | null | undefined,
  cal: CalendarData
): number | null {
  if (!dateFields || typeof dateFields !== 'object') return null;
  try {
    const dInput = {
      era_index: Number(dateFields.era_index ?? dateFields.era) || 0,
      year: Number(dateFields.year ?? dateFields.год) || 1,
      month: Number(dateFields.month ?? dateFields.месяц) || 0,
      day: Number(dateFields.day ?? dateFields.день) || 1,
      hour: Number(dateFields.hour ?? dateFields.час) || 0,
      minute: Number(dateFields.minute ?? dateFields.минута) || 0,
    };
    return CalendarMath.getAbsoluteMinute(dInput, cal);
  } catch {
    return null;
  }
}

export function formatDiegeticDate(
  mAbs: number | null | undefined,
  dateFields: Record<string, unknown> | null | undefined,
  calendarData: CalendarData | null
): string | undefined {
  const hasMabs = mAbs !== undefined && mAbs !== null;
  const hasDateFields = dateFields && typeof dateFields === 'object' && Object.keys(dateFields).length > 0;
  if (!hasMabs && !hasDateFields) return undefined;

  const cal = calendarData || CalendarFormat.getDefaultCalendar();
  try {
    let dateInput: CalendarDate['original_input'];
    if (hasDateFields) {
      dateInput = {
        era_index: Number(dateFields.era_index ?? dateFields.era) || 0,
        year: Number(dateFields.year ?? dateFields.год) || 1,
        month: Number(dateFields.month ?? dateFields.месяц) || 0,
        day: Number(dateFields.day ?? dateFields.день) || 1,
        hour: Number(dateFields.hour ?? dateFields.час) || 0,
        minute: Number(dateFields.minute ?? dateFields.минута) || 0,
      };
    } else {
      dateInput = CalendarMath.getDateFromAbsolute(mAbs!, cal);
    }

    const calculatedMabs = hasMabs ? mAbs! : CalendarMath.getAbsoluteMinute(dateInput, cal);

    const calDate: CalendarDate = {
      absolute_minute: calculatedMabs,
      calendar_id: (cal as unknown as { id?: string }).id || 'default',
      original_input: dateInput,
    };

    const formatted = CalendarFormat.formatDate(cal, calDate);
    const season = CalendarFormat.getSeasonForDate(cal, dateInput.year, dateInput.month);
    const hasSeason = season && season !== 'Вне сезона';
    const h = dateInput.hour ?? 0;
    const timeOfDay = h >= 5 && h < 12 ? 'Утро' : h >= 12 && h < 18 ? 'День' : h >= 18 && h < 23 ? 'Вечер' : 'Ночь';

    let fullStr = `⏳ ${formatted}`;
    if (hasSeason) fullStr += ` · ${season}`;
    fullStr += ` · ${timeOfDay}`;
    return fullStr;
  } catch {
    if (hasMabs) {
      const dayNum = Math.floor(mAbs! / 1440) + 1;
      return `⏳ День ${dayNum}`;
    }
    return undefined;
  }
}

export interface DiegeticAgeResult {
  ageYears: number;
  ageLabel: string;
  isBeforeBirth: boolean;
}

export function calculateDiegeticAge(
  birthMabs: number | null | undefined,
  sceneMabs: number | null | undefined,
  calendarData: CalendarData | null
): DiegeticAgeResult | null {
  if (birthMabs === undefined || birthMabs === null || sceneMabs === undefined || sceneMabs === null) {
    return null;
  }

  const cal = calendarData || CalendarFormat.getDefaultCalendar();
  const delta = sceneMabs - birthMabs;

  const settings = cal?.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
  const hInDay = Number(settings.часов_в_сутках) || 24;
  const mInHour = Number(settings.минут_в_часе) || 60;
  const minutesInDay = Math.max(1, hInDay * mInHour);

  if (delta < 0) {
    // Before birth
    const absDelta = Math.abs(delta);
    const daysInYear = CalendarMath.getBaseDaysInYear(cal) || 365;
    const minutesInYear = daysInYear * minutesInDay;

    const years = Math.floor(absDelta / minutesInYear);
    if (years >= 1) {
      return {
        ageYears: -years,
        ageLabel: `До рождения (за ${years} ${pluralize(years, 'год', 'года', 'лет')})`,
        isBeforeBirth: true,
      };
    }
    const days = Math.floor(absDelta / minutesInDay);
    return {
      ageYears: 0,
      ageLabel: `До рождения (за ${days} ${pluralize(days, 'день', 'дня', 'дней')})`,
      isBeforeBirth: true,
    };
  }

  // Born / alive
  try {
    const birthDate = CalendarMath.getDateFromAbsolute(birthMabs, cal);
    const sceneDate = CalendarMath.getDateFromAbsolute(sceneMabs, cal);

    let years = sceneDate.year - birthDate.year;
    if (
      sceneDate.month < birthDate.month ||
      (sceneDate.month === birthDate.month && sceneDate.day < birthDate.day)
    ) {
      years--;
    }

    years = Math.max(0, years);

    if (years >= 1) {
      return {
        ageYears: years,
        ageLabel: `${years} ${pluralize(years, 'год', 'года', 'лет')}`,
        isBeforeBirth: false,
      };
    }

    const days = Math.floor(delta / minutesInDay);

    if (days >= 30) {
      const months = Math.floor(days / 30);
      return {
        ageYears: 0,
        ageLabel: `${months} ${pluralize(months, 'месяц', 'месяца', 'месяцев')}`,
        isBeforeBirth: false,
      };
    }

    return {
      ageYears: 0,
      ageLabel: days === 0 ? 'Новорожденный' : `${days} ${pluralize(days, 'день', 'дня', 'дней')}`,
      isBeforeBirth: false,
    };
  } catch {
    return null;
  }
}

