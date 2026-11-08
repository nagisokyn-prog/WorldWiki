import { defineStore } from 'pinia';
import { ref } from 'vue';
import { appAlert } from '@worldwiki/components';
import * as api from '@/services/api.client';
import { calendarApi } from '@/services/api/calendar.api';
import { projectRecordId } from '@/services/api/project.api';
import { getCached, setCache, invalidateCache } from '@/utils/requestCache';
import type { CalendarData, PlanetEntity } from '@/services/Calendars/calendar.types';
import type { Calendar } from '@/types/generated/Calendar';

import { getDefaultPlanet, normalizeCalendarId, type CalendarRecord } from './calendarStore.utils';
export type { CalendarRecord } from './calendarStore.utils';
export { getDefaultPlanet, normalizeCalendarId } from './calendarStore.utils';

export const useCalendarStore = defineStore('calendar', () => {
  const isCreatingMaster = ref(false);
  const planetsByProject = ref<Record<string, PlanetEntity[]>>({});

  async function getCalendars(projectName: string): Promise<CalendarRecord[]> {
    const cacheKey = `calendars:${projectName}`;
    const cached = getCached<CalendarRecord[]>(cacheKey);
    if (cached) return cached;

    try {
      let rawList: CalendarRecord[] = [];
      try {
        const bundle = (await calendarApi.getPlanetCalendarBundle(projectName)) as {
          calendars?: CalendarRecord[];
          planets?: Array<Record<string, unknown>>;
        } | null;
        if (bundle?.calendars && bundle.calendars.length > 0) {
          rawList = bundle.calendars;
        }
        if (bundle && Array.isArray(bundle.planets)) {
          planetsByProject.value[projectName] = bundle.planets.map((p) => ({
            id: normalizeCalendarId(p.id).replace(/^planets:/, ''),
            project_id: projectName,
            name: (p.name as string) || 'Планета',
            ticks_per_day: Number(p.ticks_per_day) || 86400,
            orbit_days: Number(p.orbit_days_num && p.orbit_days_den ? (Number(p.orbit_days_num) / Number(p.orbit_days_den)) : (Number(p.orbit_days) || 365.2422)),
            axial_tilt: Number(p.axial_tilt_mdeg ? (Number(p.axial_tilt_mdeg) / 1000) : (Number(p.axial_tilt) || 0)),
            moons: Array.isArray(p.moons) ? p.moons : [],
            timezones: Array.isArray(p.timezones) ? p.timezones : [],
            regions: Array.isArray(p.regions) ? p.regions : [],
          }));
        }
      } catch (err: unknown) {
        console.warn('[CalendarStore] Failed to load planet-calendar bundle:', err);
      }

      const list = (rawList || []).map((c) => {
        const item: CalendarRecord = {
          ...c,
          id: normalizeCalendarId(c.id),
        };
        const pId = c.planet_id || (c.data as Record<string, unknown> | undefined)?.planet_id;
        if (pId) {
          item.planet_id = normalizeCalendarId(pId);
        }
        return item;
      });

      if (list && list.length > 0) {
        const hasMaster = list.some((c) => c.is_master);
        if (!hasMaster) {
          const defaultCal = list.find((c) => c.is_default) || list[0];
          defaultCal.is_master = true;
          if (defaultCal.data) {
            defaultCal.data.is_master = true;
            defaultCal.data.calendar_type = 'master';
          }
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

      const existingPlanets = getPlanets(projectName);
      let rawPlanetId = (calendar.planet_id as string) || (dataPayload.planet_id as string) || '';
      if (!rawPlanetId || rawPlanetId === 'Земля' || rawPlanetId === 'planets:earth' || rawPlanetId === 'earth' || rawPlanetId === 'planet_default_earth') {
        rawPlanetId = existingPlanets[0]?.id || '';
      }
      const cleanPlanetId = rawPlanetId ? (rawPlanetId.startsWith('planets:') ? rawPlanetId : `planets:${rawPlanetId}`) : '';

      const payload: Record<string, unknown> = {
        name: calName,
        planet_id: cleanPlanetId,
        data: dataPayload,
        is_default: is_default ?? true,
        is_master: is_master ?? false,
        project_id: projectRecordId(projectName),
      };
      if (calId) payload.id = calId;
      await api.saveCalendar(projectName, payload as unknown as Calendar);
      invalidateCache(`calendars:${projectName}`);
      return true;
    } catch (error: unknown) {
      console.error('❌ Ошибка сохранения календаря:', error);
      const msg = error instanceof Error ? error.message : String(error);
      await appAlert(`Не удалось сохранить календарь: ${msg}`, 'Ошибка календаря');
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
    } catch (error: unknown) {
      console.error('Ошибка удаления календаря:', error);
      const msg = error instanceof Error ? error.message : String(error);
      await appAlert(`Не удалось удалить календарь: ${msg}`, 'Ошибка календаря');
      return false;
    }
  }

  function getPlanets(projectName: string): PlanetEntity[] {
    const memoryPlanets = planetsByProject.value[projectName];
    if (memoryPlanets && memoryPlanets.length > 0) return memoryPlanets;
    const defaultPlanet = getDefaultPlanet(projectName);
    return [defaultPlanet];
  }

  function savePlanetToStorage(projectName: string, planet: PlanetEntity): void {
    const list = planetsByProject.value[projectName] || [getDefaultPlanet(projectName)];
    const cleanId = String(planet.id).replace(/^planets:/, '');
    const idx = list.findIndex(p => String(p.id).replace(/^planets:/, '') === cleanId);
    if (idx >= 0) {
      list[idx] = planet;
    } else {
      list.push(planet);
    }
    planetsByProject.value[projectName] = list;
  }

  async function savePlanet(projectName: string, planet: PlanetEntity): Promise<void> {
    savePlanetToStorage(projectName, planet);

    try {
      await calendarApi.savePlanetDirect(projectName, planet.id || null, planet.name, {
        ticks_per_day: planet.ticks_per_day,
        axial_tilt_mdeg: Math.round((planet.axial_tilt || 0) * 1000),
        orbit_days_num: Math.round((planet.orbit_days || 365) * 10000),
        orbit_days_den: 10000,
        moons: planet.moons || [],
        timezones: planet.timezones || [],
        regions: planet.regions || [],
      });
      invalidateCache(`calendars:${projectName}`);
    } catch (e) {
      console.error('Failed to save planet to DB:', e);
    }
  }

  function isValidCalendar(cal: unknown): boolean {
    if (!cal || typeof cal !== 'object') return false;
    const c = cal as Record<string, unknown>;
    const months = c.месяцы;
    const eras = c.эпохи;
    return Array.isArray(months) && months.length > 0 && Array.isArray(eras) && eras.length > 0;
  }

  function deletePlanetFromStorage(projectName: string, planetId: string): void {
    const list = (planetsByProject.value[projectName] || []).filter(p => p.id !== planetId);
    planetsByProject.value[projectName] = list;
  }

  async function deletePlanet(projectName: string, planetId: string): Promise<void> {
    deletePlanetFromStorage(projectName, planetId);

    try {
      await calendarApi.deletePlanetDirect(projectName, planetId, true);
      invalidateCache(`calendars:${projectName}`);
    } catch (e) {
      console.error('Failed to delete planet from DB:', e);
    }
  }

  return {
    isCreatingMaster,
    getCalendars,
    loadCalendar,
    saveCalendar,
    deleteCalendar,
    isValidCalendar,
    getPlanets,
    savePlanet,
    savePlanetToStorage,
    deletePlanet,
    deletePlanetFromStorage,
  };
});
