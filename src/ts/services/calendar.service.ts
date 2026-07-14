/**
 * @file calendar.service.ts
 * @description Сервис для работы с календарём
 * @rust-ready ✅ Расчёт дат, конвертация календарей
 */

import { apiService } from "./api.service";
import { projectService } from './project.service';

import type { CalendarData, CalendarDate } from './Calendars/calendar.types';

export const DEFAULT_CALENDAR: CalendarData = {
  название: "Григорианский (Земля)",
  дней_в_неделе: 7,
  названия_дней_недели: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  первый_месяц_года: 0,
  месяцы: [
    { название: "Январь", дней: 31 },
    { название: "Февраль", дней: 28 },
    { название: "Март", дней: 31 },
    { название: "Апрель", дней: 30 },
    { название: "Май", дней: 31 },
    { название: "Июнь", дней: 30 },
    { название: "Июль", дней: 31 },
    { название: "Август", дней: 31 },
    { название: "Сентябрь", дней: 30 },
    { название: "Октябрь", дней: 31 },
    { название: "Ноябрь", дней: 30 },
    { название: "Декабрь", дней: 31 }
  ],
  эпохи: [
    { название: "До нашей эры", год_начала: 10000, год_конца: 1, обратный_отсчет: true },
    { название: "Наша эра", год_начала: 1, год_конца: 4000 }
  ],
  правило_високосного_года: "каждый 4 год",
  пользовательское_високосное_правило: { месяц: 1, день_смещения: 1 }, // Февраль (индекс 1), +1 день
  настройки_времени: {
    часов_в_сутках: 24,
    минут_в_часе: 60,
    секунд_в_минуте: 60,
    широта: 55, // Широта Москвы
    учитывать_сезонную_длительность_дня: true
  },
  day_length_anchor: {
    summer_solstice_hours: 17.25, // 17 часов 15 минут
    winter_solstice_hours: 7.0    // 7 часов
  },
  сезоны: [
    { название: "Зима", месяцы: [11, 0, 1] }, // Дек, Янв, Фев
    { название: "Весна", месяцы: [2, 3, 4] },
    { название: "Лето", месяцы: [5, 6, 7] },
    { название: "Осень", месяцы: [8, 9, 10] }
  ],
  weather_patterns: [
    { id: 'w1', name: "Зимняя стужа", season_index: 0, temp_min: -15, temp_max: -5, precipitation: "Снег", description: "Морозно, возможны метели" },
    { id: 'w2', name: "Весенняя оттепель", season_index: 1, temp_min: 0, temp_max: 15, precipitation: "Дождь", description: "Таяние снегов, грязь" },
    { id: 'w3', name: "Летний зной", season_index: 2, temp_min: 18, temp_max: 25, precipitation: "Ясно/Грозы", description: "Тепло, редкие сильные ливни" },
    { id: 'w4', name: "Осенняя слякоть", season_index: 3, temp_min: 5, temp_max: 12, precipitation: "Дождь", description: "Пасмурно, сыро, листопад" }
  ],
  праздники: [
    { название: "Новый год", дата_начала: { месяц: 0, день: 1 } },
    { название: "Рождество", дата_начала: { месяц: 0, день: 7 } },
    { название: "День защитника Отечества", дата_начала: { месяц: 1, день: 23 } },
    { название: "Международный женский день", дата_начала: { месяц: 2, день: 8 } },
    { название: "Праздник Весны и Труда", дата_начала: { месяц: 4, день: 1 } },
    { название: "День Победы", дата_начала: { месяц: 4, день: 9 } },
    { название: "День России", дата_начала: { месяц: 5, день: 12 } },
    { название: "День народного единства", дата_начала: { месяц: 10, день: 4 } }
  ],
  moons: [
    {
      name: "Луна",
      period_days: 29.53,
      initial_phase: 0,
      phase_names: { new: "Новолуние", waxing: "Растущая", full: "Полнолуние", waning: "Убывающая" }
    }
  ]
};

class CalendarService {
  async getCalendars(projectName: string): Promise<any[]> {
    try {
      return await apiService.getCalendars(projectName);
    } catch (error) {
      console.error('Ошибка получения списка календарей:', error);
      return [];
    }
  }

  async loadCalendar(projectName: string): Promise<CalendarData | null> {
    try {
      const list = await this.getCalendars(projectName);
      if (list && list.length > 0) {
        // Return the first calendar's data (default)
        const defaultCal = list.find((c: any) => c.is_default) || list[0];
        const data = defaultCal.data || defaultCal;
        data._id = defaultCal.id;
        return data as CalendarData;
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки календаря:', error);
      return null;
    }
  }

  async saveCalendar(projectName: string, calendar: CalendarData): Promise<boolean> {
    try {
      await apiService.saveCalendar(projectName, calendar);
      console.log("✅ Календарь успешно сохранён в БД");
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения календаря:', error);
      return false;
    }
  }

  async deleteCalendar(id: string): Promise<boolean> {
    try {
      await apiService.deleteCalendar(id);
      return true;
    } catch (error) {
      console.error('Ошибка удаления календаря:', error);
      return false;
    }
  }

  /**
   * Проверка валидности календаря
   */
  isValidCalendar(calendar: CalendarData): boolean {
    return calendar &&
      Array.isArray(calendar.месяцы) &&
      calendar.месяцы.length > 0 &&
      Array.isArray(calendar.эпохи) &&
      calendar.эпохи.length > 0;
  }

  /**
   * Возвращает стандартный григорианский календарь
   */
  getDefaultCalendar(): CalendarData {
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
      пользовательское_високосное_правило: { месяц: 1, день_смещения: 29 },
      точка_отсчета: { год: 1, месяц: 0, день: 1, день_недели: 0 },
      настройки_времени: {
        часов_в_сутках: 24,
        минут_в_часе: 60,
        секунд_в_минуте: 60,
        широта: 45.0,
        учитывать_сезонную_длительность_дня: false
      },
      сезоны: [],
      фазы_луны: [],
      праздники: []
    };
  }

  /**
   * Проверка на високосный год
   */
  isLeapYear(calendar: CalendarData, year: number): boolean {
    if (!calendar) return false;
    const rule = calendar.правило_високосного_года;
    if (rule === 'григорианское') return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (rule === 'пользовательское') return true;
    return false;
  }

  /**
   * Получить количество дней в месяце с учётом високосности
   */
  getDaysInMonth(calendar: CalendarData, year: number, monthIndex: number): number {
    if (!calendar || !calendar.месяцы) return 30;
    const month = calendar.месяцы[monthIndex];
    if (!month) return 30;
    let days = month.дней;
    const leapMonth = calendar.пользовательское_високосное_правило?.месяц;
    if (this.isLeapYear(calendar, year) && monthIndex === leapMonth) {
      days += 1;
    }
    return days;
  }

  /**
   * Проверка на праздник
   */
  isHoliday(calendar: CalendarData, year: number, monthIdx: number, day: number): boolean {
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

  /**
   * Получить сезон для даты
   */
  getSeasonForDate(calendar: CalendarData, year: number, monthIdx: number): string {
    if (!calendar || !calendar.сезоны?.length) return 'Вне сезона';
    for (const season of calendar.сезоны) {
      if (season.месяцы?.includes(monthIdx)) return season.название;
    }
    return 'Вне сезона';
  }

  /**
   * Форматирование даты в читаемую строку
   */
  formatDate(calendar: CalendarData, dateObj: CalendarDate): string {
    if (!dateObj || !dateObj.original_input) return '';
    const { era_index, year: год, month: месяц, day: день, hour, minute } = dateObj.original_input;
    if (год === undefined || месяц === undefined || день === undefined) return '';

    const era = calendar.эпохи[era_index];
    const eraName = era ? era.название : '';
    const monthName = calendar.месяцы[месяц]?.название || `Месяц ${месяц + 1}`;

    let result = `${год} год, ${monthName} ${день}`;
    if (eraName) result += ` (${eraName})`;
    
    if (hour !== undefined && minute !== undefined) {
      result += ` в ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    return result;
  }

  /**
   * Получить название месяца по индексу
   */
  getMonthName(calendar: CalendarData, monthIndex: number): string {
    return calendar.месяцы[monthIndex]?.название || 'Неизвестный месяц';
  }

  /**
   * Получить название дня недели по индексу
   */
  getDayName(calendar: CalendarData, dayIndex: number): string {
    return calendar.названия_дней_недели[dayIndex] || 'День';
  }

  /**
   * Слияние данных календаря
   */
  mergeCalendarData(target: CalendarData, source: Partial<CalendarData>): CalendarData {
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

export const calendarService = new CalendarService();

// Глобальный доступ для совместимости
declare global {
  interface Window {
    calendarService: CalendarService;
  }
}

if (typeof window !== 'undefined') {
  window.calendarService = calendarService;
}
