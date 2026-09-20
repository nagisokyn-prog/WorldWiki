import { invoke } from '@tauri-apps/api/core';
import type { Calendar } from '../../types/generated/Calendar';

export async function getCalendars(project: string): Promise<Calendar[]> {
  return await invoke('get_calendars', { project });
}

export async function getCalendar(id: string): Promise<Calendar | null> {
  return await invoke('get_calendar', { id });
}

export async function saveCalendar(project: string, data: Calendar): Promise<Calendar> {
  return await invoke('save_calendar', { project, data });
}

export async function deleteCalendar(id: string): Promise<void> {
  return await invoke('delete_calendar', { id });
}

export async function convertAbsoluteToLocal(absoluteMinute: number, calendar: unknown, eraIndex: number): Promise<unknown> {
  return await invoke('convert_absolute_to_local', { absoluteMinute, calendar, eraIndex });
}

export async function convertCalendarDate(
  fromCalendar: unknown,
  toCalendar: unknown,
  masterCalendar: unknown | null,
  eraIndex: number,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  targetEraIndex: number | null
): Promise<unknown> {
  return await invoke('convert_calendar_date', {
    fromCalendar,
    toCalendar,
    masterCalendar,
    eraIndex,
    year,
    month,
    day,
    hour,
    minute,
    targetEraIndex
  });
}
