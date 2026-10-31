import { defineStore } from 'pinia';
import { ref } from 'vue';
import { appAlert } from '@worldwiki/components';
import * as api from '../services/api.client';
import { calendarApi } from '../services/api/calendar.api';
import { projectRecordId } from '../services/api/project.api';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';
import type { CalendarData, PlanetEntity } from '../services/Calendars/calendar.types';
import { CalendarMath } from '../services/Calendars/useCalendarEngine';
import type { Calendar } from '../types/generated/Calendar';

export function getDefaultPlanet(projectName: string): PlanetEntity {
  return {
    id: 'earth', project_id: projectName, name: 'Земля', ticks_per_day: 86400,
    orbit_days: 365.2422, axial_tilt: 23.44, is_retrograde: false, solstice_world_day: 355,
    timezones: [
      { id: 'tz_utc', name: 'Гринвич (UTC)', code: 'UTC', base_offset_hours: 0 },
      { id: 'tz_msk', name: 'Москва (MSK)', code: 'MSK', base_offset_hours: 3 },
    ],
    regions: [{
      id: 'reg_default', name: 'Умеренные широты', timezone_id: 'tz_utc',
      latitude: 55.75, longitude: 37.61, summer_day_hours: 17.5, winter_day_hours: 7.0,
    }],
    moons: [{
      name: 'Луна', period_days: 29.53, period_days_num: 2953, period_days_den: 100,
      initial_phase: 0, initial_phase_bp: 0,
    }],
  };
}

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
    const s = id.includes('{String:') ? id.replace(/.*String:"?([^"]+)"?.*/, '$1') : id;
    return s.replace(/["'⟨⟩]/g, '').trim();
  }
  if (typeof id === 'object') {
    const obj = id as Record<string, unknown>;
    if (obj.tb && obj.id) {
      const inner = typeof obj.id === 'object' && obj.id !== null
        ? ((obj.id as Record<string, unknown>).String ?? (obj.id as Record<string, unknown>).Int ?? JSON.stringify(obj.id))
        : obj.id;
      return `${obj.tb}:${String(inner).replace(/["'⟨⟩]/g, '')}`.trim();
    }
    if (obj.String) return String(obj.String).replace(/["'⟨⟩]/g, '').trim();
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
          if (bundle.planets.length === 0) {
            localStorage.removeItem(`worldwiki:planets:${projectName}`);
          } else {
            const mappedPlanets: PlanetEntity[] = bundle.planets.map((p) => ({
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
            localStorage.setItem(`worldwiki:planets:${projectName}`, JSON.stringify(mappedPlanets));
          }
        }
      } catch (err: unknown) {
        console.warn('[CalendarStore] Failed to load planet-calendar bundle fallback:', err);
      }

      if (rawList.length === 0) {
        const directList = (await api.getCalendars(projectName).catch(() => [])) as unknown as CalendarRecord[];
        if (directList && directList.length > 0) {
          rawList = directList;
        }
      }

      const list = (rawList || []).map((c) => ({
        ...c,
        id: normalizeCalendarId(c.id),
        planet_id: normalizeCalendarId(c.planet_id || (c.data as Record<string, unknown> | undefined)?.planet_id || 'planets:earth'),
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
          defaultCalData.planet_id = 'earth';
          defaultCalData.название = 'Григорианский';
          await saveCalendar(projectName, { ...defaultCalData, is_default: true, is_master: true } as unknown as CalendarData);
          const rawNewList = (await api.getCalendars(projectName)) as unknown as CalendarRecord[];
          const newList = (rawNewList || []).map((c) => ({
            ...c,
            id: normalizeCalendarId(c.id),
            planet_id: normalizeCalendarId(c.planet_id || (c.data as Record<string, unknown> | undefined)?.planet_id || 'planets:earth'),
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

      let rawPlanetId = (calendar.planet_id as string) || (dataPayload.planet_id as string) || 'planets:earth';
      if (!rawPlanetId || rawPlanetId === 'Земля') {
        rawPlanetId = 'planets:earth';
      }
      const cleanPlanetId = rawPlanetId.startsWith('planets:') ? rawPlanetId : `planets:${rawPlanetId}`;
      const planetRawId = cleanPlanetId.replace(/^planets:/, '');

      // Ensure planet exists in DB first
      const defaultPlanet = getDefaultPlanet(projectName);
      try {
        await calendarApi.savePlanetDirect(projectName, planetRawId, defaultPlanet.name, {
          ticks_per_day: defaultPlanet.ticks_per_day,
          axial_tilt_mdeg: Math.round((defaultPlanet.axial_tilt || 0) * 1000),
          orbit_days_num: Math.round(defaultPlanet.orbit_days * 10000),
          orbit_days_den: 10000,
          moons: defaultPlanet.moons || [],
        });
      } catch (err) {
        console.warn('Could not auto-save planet to DB (may already exist):', err);
      }

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
      console.log("✅ Календарь успешно сохранён в БД");
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

  function readPlanetsFromStorage(projectName: string): PlanetEntity[] | null {
    const key = `worldwiki:planets:${projectName}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse planets from storage:', e);
    }
    return null;
  }

  function getPlanets(projectName: string): PlanetEntity[] {
    const existing = readPlanetsFromStorage(projectName);
    if (existing) return existing;
    const defaultPlanet = getDefaultPlanet(projectName);
    const key = `worldwiki:planets:${projectName}`;
    try {
      localStorage.setItem(key, JSON.stringify([defaultPlanet]));
    } catch (e) {
      console.error('Failed to save default planet:', e);
    }
    return [defaultPlanet];
  }

  function savePlanetToStorage(projectName: string, planet: PlanetEntity): void {
    const key = `worldwiki:planets:${projectName}`;
    const list = readPlanetsFromStorage(projectName) || [getDefaultPlanet(projectName)];
    const idx = list.findIndex(p => p.id === planet.id);
    if (idx >= 0) {
      list[idx] = planet;
    } else {
      list.push(planet);
    }
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save planet to storage:', e);
    }
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
      });
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
    const key = `worldwiki:planets:${projectName}`;
    const list = (readPlanetsFromStorage(projectName) || []).filter(p => p.id !== planetId);
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to delete planet from storage:', e);
    }
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
