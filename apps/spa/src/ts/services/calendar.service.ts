/**
 * @file calendar.service.ts
 * @description Сервис для работы с календарём
 * @rust-ready ✅ Расчёт дат, конвертация календарей
 */

import { apiService } from "./api.service";
import { projectService } from './project.service';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';

import type { CalendarData, CalendarDate } from './Calendars/calendar.types';
import { CalendarMath } from './Calendars/calendar.math';

let isCreatingMaster = false;

class CalendarService {
  async getCalendars(projectName: string): Promise<any[]> {
    const cacheKey = `calendars:${projectName}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const list = await apiService.getCalendars(projectName);
      if (list && list.length > 0) {
        // Ensure at least one calendar is master
        const hasMaster = list.some((c: any) => c.is_master);
        if (!hasMaster) {
          if (isCreatingMaster) return list;
          isCreatingMaster = true;
          try {
            // Upgrade the default or first one
            const defaultCal = list.find((c: any) => c.is_default) || list[0];
            defaultCal.is_master = true;
            if (defaultCal.data) {
              defaultCal.data.is_master = true;
              defaultCal.data.calendar_type = 'master';
              if (list.length === 1) {
                 defaultCal.data.название = 'Календарь Мира';
                 defaultCal.name = 'Календарь Мира';
              }
            }
            await this.saveCalendar(projectName, { ...defaultCal.data, id: defaultCal.id, is_default: defaultCal.is_default, is_master: true });
          } finally {
            isCreatingMaster = false;
          }
        }
      } else {
        if (isCreatingMaster) return [];
        isCreatingMaster = true;
        try {
          // Auto-create World Calendar if none exist
          const defaultCalData = CalendarMath.getDefaultCalendar();
          defaultCalData.is_master = true;
          defaultCalData.calendar_type = 'master';
          defaultCalData.название = 'Календарь Мира';
          await this.saveCalendar(projectName, { ...defaultCalData, is_default: true, is_master: true } as any);
          // Fetch again to get the assigned ID
          const newList = await apiService.getCalendars(projectName);
          setCache(cacheKey, newList || []);
          return newList || [];
        } finally {
          isCreatingMaster = false;
        }
      }
      setCache(cacheKey, list);
      return list;
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
      invalidateCache(`calendars:${projectName}`);
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
      invalidateCache('calendars:');
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
