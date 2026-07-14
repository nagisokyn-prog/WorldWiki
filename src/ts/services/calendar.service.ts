/**
 * @file calendar.service.ts
 * @description Сервис для работы с календарём
 * @rust-ready ✅ Расчёт дат, конвертация календарей
 */

import { apiService } from "./api.service";
import { projectService } from './project.service';

import type { CalendarData, CalendarDate } from './Calendars/calendar.types';


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
