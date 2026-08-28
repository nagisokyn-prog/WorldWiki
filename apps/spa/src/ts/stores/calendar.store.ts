import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '../services/api.client';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';
import type { CalendarData } from '../services/Calendars/calendar.types';
import { CalendarMath } from '../services/Calendars/calendar.math';
import type { Calendar } from '../types/generated/Calendar';

export interface CalendarRecord {
  id?: string;
  name?: string;
  is_default?: boolean;
  is_master?: boolean;
  data?: CalendarData & { [key: string]: unknown };
  [key: string]: unknown;
}

export function normalizeCalendarId(id: unknown): string {
  if (!id) return '';
  if (typeof id === 'string') {
    let s = id;
    if (s.includes('{String:')) {
      s = s.replace(/.*String:\"?([^\"]+)\"?.*/, '$1');
    }
    return s.replace(/["'⟨⟩]/g, '').trim();
  }
  if (typeof id === 'object') {
    const obj = id as Record<string, unknown>;
    if (obj.tb && obj.id) {
      const tb = String(obj.tb);
      let inner = obj.id;
      if (typeof inner === 'object' && inner !== null) {
        const innerObj = inner as Record<string, unknown>;
        inner = innerObj.String ?? innerObj.Int ?? innerObj.Uuid ?? JSON.stringify(inner);
      }
      return `${tb}:${String(inner).replace(/["'⟨⟩]/g, '')}`.trim();
    }
    if (obj.String) {
      return String(obj.String).replace(/["'⟨⟩]/g, '').trim();
    }
  }
  return String(id).replace(/["'⟨⟩]/g, '').trim();
}

export const useCalendarStore = defineStore('calendar', () => {
  const isCreatingMaster = ref(false);

  async function getCalendars(projectName: string): Promise<CalendarRecord[]> {
    const cacheKey = `calendars:${projectName}`;
    const cached = getCached<CalendarRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      const rawList = (await api.getCalendars(projectName)) as CalendarRecord[];
      const list = (rawList || []).map((c) => ({
        ...c,
        id: normalizeCalendarId(c.id),
      }));

      if (list && list.length > 0) {
        const hasMaster = list.some((c) => c.is_master);
        if (!hasMaster) {
          if (isCreatingMaster.value) return list;
          isCreatingMaster.value = true;
          try {
            const defaultCal = list.find((c) => c.is_default) || list[0];
            defaultCal.is_master = true;
            if (defaultCal.data) {
              defaultCal.data.is_master = true;
              defaultCal.data.calendar_type = 'master';
              if (list.length === 1) {
                defaultCal.data.название = 'Календарь Мира';
                defaultCal.name = 'Календарь Мира';
              }
            }
            await saveCalendar(projectName, { ...(defaultCal.data || {}), id: defaultCal.id, is_default: defaultCal.is_default, is_master: true } as unknown as CalendarData);
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
          await saveCalendar(projectName, { ...defaultCalData, is_default: true, is_master: true } as unknown as CalendarData);
          const rawNewList = (await api.getCalendars(projectName)) as CalendarRecord[];
          const newList = (rawNewList || []).map((c) => ({
            ...c,
            id: normalizeCalendarId(c.id),
          }));
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
        const defaultCal = list.find((c) => c.is_default) || list[0];
        const data = defaultCal.data || (defaultCal as unknown as CalendarData);
        data._id = defaultCal.id;
        return data as CalendarData;
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки календаря:', error);
      return null;
    }
  }

  async function saveCalendar(projectName: string, calendar: CalendarData & { [key: string]: unknown }): Promise<boolean> {
    try {
      const calName = (calendar.название as string) || (calendar.name as string) || 'Календарь';
      const calId = (calendar._id as string) || (calendar.id as string) || null;
      const is_default = calendar.is_default as boolean | undefined;
      const is_master = calendar.is_master as boolean | undefined;
      const dataPayload: Record<string, unknown> = { ...calendar };
      delete dataPayload._id;
      delete dataPayload.id;
      delete dataPayload.is_default;
      delete dataPayload.is_master;
      const payload: Record<string, unknown> = {
        name: calName,
        data: dataPayload,
        is_default: is_default ?? true,
        is_master: is_master ?? false,
        project_id: `projects:${projectName}`,
      };
      if (calId) payload.id = calId;
      await api.saveCalendar(projectName, payload as unknown as Calendar);
      invalidateCache(`calendars:${projectName}`);
      console.log("✅ Календарь успешно сохранён в БД");
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения календаря:', error);
      return false;
    }
  }

  async function deleteCalendar(id: unknown): Promise<boolean> {
    try {
      const cleanId = normalizeCalendarId(id);
      if (!cleanId) return false;
      await api.deleteCalendar(cleanId);
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
    isCreatingMaster,
    getCalendars,
    loadCalendar,
    saveCalendar,
    deleteCalendar,
    isValidCalendar
  };
});
