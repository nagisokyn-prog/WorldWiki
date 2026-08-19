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
    const calendarPayload = { ...plainData };
    delete calendarPayload.id;
    delete calendarPayload._id;
    delete calendarPayload.is_default;
    delete calendarPayload.is_master;
    const rustCalendar = {
      id: id || null,
      project_id: projectRecordId(project),
      name: plainData.название || 'Новый календарь',
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
};