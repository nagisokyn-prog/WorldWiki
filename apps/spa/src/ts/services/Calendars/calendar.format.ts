/**
 * @file calendar.format.ts
 * @description Форматирование, парсинг дат, праздники и лор-объяснения
 */

import {
  DEFAULT_CALENDAR_SEASONS,
  type CalendarData,
  type CalendarDate
} from './calendar.types';

export class CalendarFormat {
  public static isHoliday(calendar: CalendarData, _year: number, monthIdx: number, day: number): boolean {
    if (!calendar || !calendar.праздники) return false;
    for (const h of calendar.праздники) {
      const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
      const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
      if (monthIdx >= sm && monthIdx <= em) {
        if (monthIdx === sm && monthIdx === em) return day >= sd && day <= ed;
        if (monthIdx === sm) return day >= sd;
        if (monthIdx === em) return day <= ed;
        return true;
      }
    }
    return false;
  }

  public static getSeasonForDate(calendar: CalendarData, _year: number, monthIdx: number): string {
    if (!calendar || !calendar.сезоны?.length) return 'Вне сезона';
    for (const season of calendar.сезоны) {
      if (season.месяцы?.includes(monthIdx)) return season.название;
    }
    return 'Вне сезона';
  }

  public static formatDate(calendar: CalendarData, dateObj: CalendarDate): string {
    if (!calendar || !dateObj || !dateObj.original_input) return '';
    const { era_index, year: год, month: месяц, day: день, hour, minute } = dateObj.original_input;
    if (год === undefined || месяц === undefined || день === undefined) return '';

    const era = calendar.эпохи?.[era_index];
    const eraName = era ? era.название : '';
    const monthName = calendar.месяцы?.[месяц]?.название || `Месяц ${месяц + 1}`;

    let result = `${год} год, ${monthName} ${день}`;
    if (eraName) result += ` (${eraName})`;
    
    if (hour !== undefined && minute !== undefined) {
      result += ` в ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    return result;
  }

  public static parseDurationString(
    input: string,
    calendar: CalendarData,
    getDaysInYear: (cal: CalendarData, y: number) => number
  ): number {
    const settings = calendar.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 0,
      учитывать_сезонную_длительность_дня: false
    };
    const minutesInDay = settings.часов_в_сутках * settings.минут_в_часе;

    let addDays = 0;
    const matchYears = input.match(/(\d+)\s*(год|лет|года)/i);
    if (matchYears) {
      addDays += parseInt(matchYears[1]) * getDaysInYear(calendar, 1);
    }

    const matchMonths = input.match(/(\d+)\s*(месяц|месяца|месяцев)/i);
    if (matchMonths) {
      addDays += parseInt(matchMonths[1]) * 30;
    }

    const matchDays = input.match(/(\d+)\s*(день|дня|дней)/i);
    if (matchDays) {
      addDays += parseInt(matchDays[1]);
    }

    const matchHours = input.match(/(\d+)\s*(час|часа|часов)/i);
    let addMinutes = 0;
    if (matchHours) {
      addMinutes += parseInt(matchHours[1]) * settings.минут_в_часе;
    }

    return (addDays * minutesInDay) + addMinutes;
  }

  public static getDefaultCalendar(): CalendarData {
    return {
      название: 'Григорианский календарь',
      дней_в_неделе: 7,
      названия_дней_недели: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      первый_месяц_года: 0,
      месяцы: [
        { название: 'Январь', дней: 31 },
        { название: 'Февраль', дней: 28 },
        { название: 'Март', дней: 31 },
        { название: 'Апрель', дней: 30 },
        { название: 'Май', дней: 31 },
        { название: 'Июнь', дней: 30 },
        { название: 'Июль', дней: 31 },
        { название: 'Август', дней: 31 },
        { название: 'Сентябрь', дней: 30 },
        { название: 'Октябрь', дней: 31 },
        { название: 'Ноябрь', дней: 30 },
        { название: 'Декабрь', дней: 31 }
      ],
      эпохи: [{ название: 'Наша эра', год_начала: 1, год_конца: 9999 }],
      правило_високосного_года: 'григорианское',
      пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 },
      точка_отсчета: { эпоха: 0, год: 1, месяц: 0, день: 1, день_недели: 0 },
      настройки_времени: {
        часов_в_сутках: 24,
        минут_в_часе: 60,
        секунд_в_минуте: 60,
        широта: 45.0,
        учитывать_сезонную_длительность_дня: false
      },
      сезоны: JSON.parse(JSON.stringify(DEFAULT_CALENDAR_SEASONS)),
      праздники: [],
      moons: [],
      weather_patterns: []
    };
  }

  public static mergeCalendarData(target: CalendarData, source: Partial<CalendarData>): CalendarData {
    const merged = JSON.parse(JSON.stringify(target)) as CalendarData;
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && Object.prototype.hasOwnProperty.call(merged, key)) {
        const sourceVal = (source as Record<string, unknown>)[key];
        const mergedVal = (merged as Record<string, unknown>)[key];
        if (typeof sourceVal === 'object' && sourceVal !== null && !Array.isArray(sourceVal) &&
            typeof mergedVal === 'object' && mergedVal !== null && !Array.isArray(mergedVal)) {
          (merged as Record<string, unknown>)[key] = { ...mergedVal, ...sourceVal };
        } else {
          (merged as Record<string, unknown>)[key] = sourceVal;
        }
      }
    }
    return merged;
  }
}
