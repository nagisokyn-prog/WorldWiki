import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '../services/api.client';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';
import type { CalendarData } from '../services/Calendars/calendar.types';
import { CalendarMath } from '../services/Calendars/calendar.math';

export const useCalendarStore = defineStore('calendar', () => {
  const isCreatingMaster = ref(false);

  async function getCalendars(projectName: string): Promise<any[]> {
    const cacheKey = `calendars:${projectName}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const list = await api.getCalendars(projectName);
      if (list && list.length > 0) {
        const hasMaster = list.some((c: any) => c.is_master);
        if (!hasMaster) {
          if (isCreatingMaster.value) return list;
          isCreatingMaster.value = true;
          try {
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
            await saveCalendar(projectName, { ...defaultCal.data, id: defaultCal.id, is_default: defaultCal.is_default, is_master: true });
          } finally {
            isCreatingMaster.value = false;
          }
        }
      } else {
        if (isCreatingMaster.value) return [];
        isCreatingMaster.value = true;
        try {
          const defaultCalData = CalendarMath.getDefaultCalendar();
          defaultCalData.is_master = true;
          defaultCalData.calendar_type = 'master';
          defaultCalData.название = 'Календарь Мира';
          await saveCalendar(projectName, { ...defaultCalData, is_default: true, is_master: true } as any);
          const newList = await api.getCalendars(projectName);
          setCache(cacheKey, newList || []);
          return newList || [];
        } finally {
          isCreatingMaster.value = false;
        }
      }
      setCache(cacheKey, list);
      return list;
    } catch (error) {
      console.error('Ошибка получения списка календарей:', error);
      return [];
    }
  }

  async function loadCalendar(projectName: string): Promise<CalendarData | null> {
    try {
      const list = await getCalendars(projectName);
      if (list && list.length > 0) {
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

  async function saveCalendar(projectName: string, calendar: CalendarData): Promise<boolean> {
    try {
      await api.saveCalendar(calendar as any);
      invalidateCache(`calendars:${projectName}`);
      console.log("✅ Календарь успешно сохранён в БД");
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения календаря:', error);
      return false;
    }
  }

  async function deleteCalendar(id: string): Promise<boolean> {
    try {
      await api.deleteCalendar(id);
      invalidateCache('calendars:');
      return true;
    } catch (error) {
      console.error('Ошибка удаления календаря:', error);
      return false;
    }
  }

  function isValidCalendar(calendar: CalendarData): boolean {
    return calendar &&
      Array.isArray(calendar.месяцы) &&
      calendar.месяцы.length > 0 &&
      Array.isArray(calendar.эпохи) &&
      calendar.эпохи.length > 0;
  }

  return {
    getCalendars,
    loadCalendar,
    saveCalendar,
    deleteCalendar,
    isValidCalendar
  };
});
