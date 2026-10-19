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

    const rustCalendar = {
      id: id || null,
      project_id: projectRecordId(project),
      name: (actualData.название as string) || (plainData.name as string) || 'Новый календарь',
      is_default: is_default || false,
      is_master: is_master || false,
      data: calendarPayload
    };
    return invoke<{ success: boolean }>('save_calendar', { data: rustCalendar });
  },

  deleteCalendar: (id: string): Promise<void> =>
    invoke<void>('delete_calendar', { id }),

  getGlobalTimeline: (project: string): Promise<unknown> =>
    invoke<unknown>('get_global_timeline', { project }),

  saveGlobalTimeline: (project: string, data: unknown): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_global_timeline', { project, data }),

  getPlanetCalendarBundle: (project: string): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::get_planet_calendar_bundle(type::record("projects", $project));',
      params: { project },
    }),

  savePlanetDirect: (project: string, planetId: string | null, name: string, data: Record<string, unknown>): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::save_planet(type::record("projects", $project), $planetId, $name, $data);',
      params: { project, planetId, name, data },
    }),

  saveCalendarDirect: (project: string, calendarId: string | null, planetId: string | null, name: string, isMaster: boolean, data: Record<string, unknown>): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::save_calendar(type::record("projects", $project), $calendarId, $planetId, $name, $isMaster, $data);',
      params: { project, calendarId, planetId, name, isMaster, data },
    }),

  setMasterCalendar: (project: string, calendarId: string): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::set_master_calendar(type::record("projects", $project), type::record("calendars", $calendarId));',
      params: { project, calendarId },
    }),

  deletePlanetDirect: (planetId: string): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::delete_planet(type::record("planets", $planetId));',
      params: { planetId },
    }),

  deleteCalendarDirect: (calendarId: string): Promise<unknown> =>
    invoke<unknown>('run_surql_query', {
      query: 'RETURN fn::delete_calendar(type::record("calendars", $calendarId));',
      params: { calendarId },
    }),
};