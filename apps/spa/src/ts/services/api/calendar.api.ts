/**
 * @file calendar.api.ts
 * @description API-методы для работы с календарями и таймлайнами
 */

import { invoke } from '@worldwiki/components';
import { projectRecordId } from './project.api';

export const calendarApi = {
  getCalendars: (project: string): Promise<Record<string, unknown>[]> =>
    invoke<Record<string, unknown>[]>('get_calendars', { project }),

  saveCalendar: (project: string, calendarData: Record<string, unknown>): Promise<{ success: boolean }> => {
    const plainData = JSON.parse(JSON.stringify(calendarData)) as Record<string, unknown>;
    const { id, is_default, is_master } = plainData;
    const actualData = (plainData.data && typeof plainData.data === 'object' && !Array.isArray(plainData.data))
      ? (plainData.data as Record<string, unknown>)
      : plainData;

    const calendarPayload = { ...actualData };
    delete calendarPayload.id;
    delete calendarPayload._id;
    delete calendarPayload.is_default;
    delete calendarPayload.is_master;

    const rustCalendar: Record<string, unknown> = {
      id: id || null,
      project_id: projectRecordId(project),
      name: (actualData.название as string) || (plainData.name as string) || 'Новый календарь',
      is_default: is_default || false,
      is_master: is_master || false,
      data: calendarPayload
    };
    const pId = (plainData.planet_id as string) || (actualData.planet_id as string);
    if (pId) {
      rustCalendar.planet_id = pId;
    }
    return invoke<{ success: boolean }>('save_calendar', { data: rustCalendar });
  },

  deleteCalendar: (id: string): Promise<void> =>
    invoke<void>('delete_calendar', { id }),

  getGlobalTimeline: (project: string): Promise<unknown> =>
    invoke<unknown>('get_global_timeline', { project }),

  saveGlobalTimeline: (project: string, data: unknown): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_global_timeline', { project, data }),

  getPlanetCalendarBundle: (project: string): Promise<unknown> =>
    invoke<unknown>('get_planet_calendar_bundle', { project }),

  savePlanetDirect: (project: string, planetId: string | null, name: string, data: Record<string, unknown>): Promise<unknown> => {
    const rawMoons = Array.isArray(data.moons) ? data.moons : null;
    const sanitizedMoons = rawMoons
      ? rawMoons.map((m: unknown) => {
          if (typeof m === 'object' && m !== null) {
            const rest = { ...(m as Record<string, unknown>) };
            delete rest.color;
            return rest;
          }
          return m;
        })
      : null;

    return invoke<unknown>('save_planet', {
      params: {
        project,
        planet_id: planetId || null,
        name,
        ticks_per_day: Number(data.ticks_per_day) || 86400,
        axial_tilt_mdeg: Number(data.axial_tilt_mdeg) || 0,
        orbit_days_num: Number(data.orbit_days_num) || 365,
        orbit_days_den: Number(data.orbit_days_den) || 1,
        moons: sanitizedMoons,
        timezones: Array.isArray(data.timezones) ? data.timezones : [],
        regions: Array.isArray(data.regions) ? data.regions : [],
      },
    });
  },

  saveCalendarDirect: (project: string, calendarId: string | null, planetId: string | null, name: string, isMaster: boolean, data: Record<string, unknown>): Promise<unknown> =>
    invoke<unknown>('save_calendar_direct', {
      project,
      calendarId: calendarId || null,
      planetId: planetId || 'earth',
      name,
      isMaster,
      data,
    }),

  setMasterCalendar: (project: string, planetId: string, calendarId: string): Promise<unknown> =>
    invoke<unknown>('set_master_calendar', {
      project,
      planetId,
      calendarId,
    }),

  deletePlanetDirect: (project: string, planetId: string, cascade?: boolean): Promise<unknown> =>
    invoke<unknown>('delete_planet', {
      project,
      planetId,
      cascade: cascade ?? true,
    }),

  deleteCalendarDirect: (calendarId: string): Promise<unknown> =>
    invoke<unknown>('delete_calendar_direct', {
      calendarId,
    }),
};
