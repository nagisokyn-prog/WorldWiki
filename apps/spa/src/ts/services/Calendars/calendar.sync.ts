import type {
  CalendarData,
  CalendarDate,
  WorldMoment
} from './calendar.types';
import { CalendarCycles } from './calendar.cycles';

export class CalendarSync {
  /**
   * Вычислить смещение (в абсолютных минутах) между локальным и мастер-календарём.
   * master_minute = local_minute + offset
   */
  public static getAnchorOffset(
    localCal: CalendarData,
    masterCal?: CalendarData | null,
    getAbsMinuteFn?: (input: CalendarDate['original_input'], cal: CalendarData) => number
  ): number {
    if (!localCal || localCal.is_master || !localCal.sync_anchor?.linked_to_master) {
      return 0;
    }

    const anchor = localCal.sync_anchor;

    if (anchor.local_anchor_date && anchor.master_anchor_date && masterCal && getAbsMinuteFn) {
      const localMin = getAbsMinuteFn(anchor.local_anchor_date, localCal);
      const masterMin = getAbsMinuteFn(anchor.master_anchor_date, masterCal);
      return masterMin - localMin;
    }

    if (anchor.master_absolute_minute !== undefined && anchor.local_absolute_minute !== undefined) {
      return anchor.master_absolute_minute - anchor.local_absolute_minute;
    }

    return 0;
  }

  /**
   * Литературное описание смещения эпох вместо технических минут/дней.
   */
  public static formatAnchorOffsetDescription(
    localCal: CalendarData,
    masterCal?: CalendarData | null,
    getOffsetFn?: (localCal: CalendarData, masterCal?: CalendarData | null) => number
  ): string {
    if (!localCal) return '';
    if (localCal.is_master) return 'Календарь Мира (эталон физического времени).';
    if (!localCal.sync_anchor?.linked_to_master) {
      return 'Календарь ещё не привязан к Календарю Мира.';
    }

    const offsetMinutes = getOffsetFn ? getOffsetFn(localCal, masterCal) : 0;
    if (offsetMinutes === 0) {
      return 'Точка отсчета совпадает с началом Календаря Мира.';
    }

    const settings = localCal.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const minutesInDay = (settings.часов_в_сутках || 24) * (settings.минут_в_часе || 60);
    const daysDiff = Math.round(offsetMinutes / minutesInDay);
    const daysInYear = CalendarCycles.getDaysInYear(localCal, 1) || 365;

    const absDays = Math.abs(daysDiff);
    const years = Math.floor(absDays / daysInYear);
    const remDays = absDays % daysInYear;

    let timeSpan: string;
    if (years > 0 && remDays > 0) {
      timeSpan = `${years} г. и ${remDays} дн.`;
    } else if (years > 0) {
      timeSpan = `${years} г.`;
    } else {
      timeSpan = `${remDays} дн.`;
    }

    if (offsetMinutes < 0) {
      return `Летоисчисление культуры началось на ${timeSpan} раньше Календаря Мира.`;
    } else {
      return `Летоисчисление культуры началось на ${timeSpan} позже Календаря Мира.`;
    }
  }

  /**
   * Перевод календарной даты культуры в физический WorldMoment (Мировые сутки + Доля суток)
   */
  public static dateToWorldMoment(
    date: CalendarDate['original_input'],
    calendar: CalendarData,
    offsetHours: number = 0,
    masterCal?: CalendarData | null,
    getAnchorOffsetFn?: (localCal: CalendarData, masterCal?: CalendarData | null) => number
  ): WorldMoment {
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const dayMinutes = hInDay * mInHour;

    const hour = date.hour ?? 0;
    const minute = date.minute ?? 0;
    const localMinutes = hour * mInHour + minute;
    const localFraction = dayMinutes > 0 ? localMinutes / dayMinutes : 0;

    const localTotalDays = CalendarCycles.getTotalDays(date, calendar);
    let worldDayIndex = localTotalDays;

    if (!calendar.is_master && calendar.sync_anchor?.linked_to_master && getAnchorOffsetFn) {
      const anchorOffsetMinutes = getAnchorOffsetFn(calendar, masterCal);
      const daysOffset = Math.round(anchorOffsetMinutes / dayMinutes);
      worldDayIndex = localTotalDays + daysOffset;
    }

    let worldFraction = localFraction - (offsetHours / 24);
    if (!Number.isFinite(worldFraction)) {
      worldFraction = 0;
    } else {
      const floorDays = Math.floor(worldFraction);
      worldFraction -= floorDays;
      worldDayIndex += floorDays;
    }

    return {
      day_index: worldDayIndex,
      day_fraction: worldFraction
    };
  }

  /**
   * Проекция физического WorldMoment в часы и дату конкретной культуры с учётом пояса региона
   */
  public static worldMomentToDate(
    moment: WorldMoment,
    calendar: CalendarData,
    offsetHours: number = 0,
    masterCal?: CalendarData | null,
    era_index: number = 0,
    getAnchorOffsetFn?: (localCal: CalendarData, masterCal?: CalendarData | null) => number
  ): CalendarDate['original_input'] {
    const settings = calendar.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const hInDay = settings.часов_в_сутках || 24;
    const mInHour = settings.минут_в_часе || 60;
    const dayMinutes = hInDay * mInHour;

    let localFraction = (Number.isFinite(moment.day_fraction) ? moment.day_fraction : 0) + (offsetHours / 24);
    let localDayIndex = Number.isFinite(moment.day_index) ? moment.day_index : 0;

    if (!Number.isFinite(localFraction)) {
      localFraction = 0;
    } else {
      const floorDays = Math.floor(localFraction);
      localFraction -= floorDays;
      localDayIndex += floorDays;
    }

    if (!calendar.is_master && calendar.sync_anchor?.linked_to_master && getAnchorOffsetFn) {
      const anchorOffsetMinutes = getAnchorOffsetFn(calendar, masterCal);
      const daysOffset = Math.round(anchorOffsetMinutes / dayMinutes);
      localDayIndex = localDayIndex - daysOffset;
    }

    const dateWithoutTime = CalendarCycles.getDateFromTotalDays(localDayIndex, calendar, era_index);
    const totalLocalMinutes = Math.round(localFraction * dayMinutes) % dayMinutes;
    const hour = Math.floor(totalLocalMinutes / mInHour);
    const minute = totalLocalMinutes % mInHour;

    return {
      ...dateWithoutTime,
      hour,
      minute
    };
  }
}
