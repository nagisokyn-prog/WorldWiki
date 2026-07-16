/**
 * @file calendar.api.ts
 * @description API-методы для работы с календарями и таймлайнами
 */

import { invoke } from '@worldwiki/components';
import { projectRecordId } from './project.api';

export const calendarApi = {
  getCalendars: (project: string): Promise<any[]> =>
    invoke<any[]>('get_calendars', { project }),

  saveCalendar: (project: string, calendarData: any): Promise<{ success: boolean }> => {
    const plainData = JSON.parse(JSON.stringify(calendarData));
    const { id, is_default, _id, ...calendarPayload } = plainData;
    const rustCalendar = {
      id: id || null,
      project_id: projectRecordId(project),
      name: plainData.название || 'Новый календарь',
      is_default: is_default || false,
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