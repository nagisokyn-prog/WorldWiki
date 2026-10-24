import { invoke } from '@tauri-apps/api/core';
import type { Calendar, Cites, Plan, Tag } from './types';

export async function convertAbsoluteToLocal(absoluteMinute: number, calendar: unknown, eraIndex: number): Promise<unknown> {
  return await invoke('convert_absolute_to_local', { absoluteMinute, calendar, eraIndex });
}

export async function convertCalendarDate(params: unknown): Promise<unknown> {
  return await invoke('convert_calendar_date', { params });
}


export async function completePlan(planId: string): Promise<void> {
  return await invoke('complete_plan', { planId });
}

export async function auditVolumeConsistency(volumeId: string): Promise<unknown> {
  return await invoke('audit_volume_consistency', { volumeId });
}

export async function getPlans(project: string): Promise<Plan[]> {
  return await invoke('get_plans', { project });
}

export async function getPlan(id: string): Promise<Plan | null> {
  return await invoke('get_plan', { id });
}

export async function savePlan(project: string, data: Plan): Promise<Plan> {
  return await invoke('save_plan', { project, data });
}

export async function deletePlan(id: string): Promise<void> {
  return await invoke('delete_plan', { id });
}


export async function getTags(project: string): Promise<Tag[]> {
  return await invoke('get_tags', { project });
}

export async function getTag(id: string): Promise<Tag | null> {
  return await invoke('get_tag', { id });
}

export async function saveTag(project: string, data: Tag): Promise<Tag> {
  return await invoke('save_tag', { project, data });
}

export async function deleteTag(id: string): Promise<void> {
  return await invoke('delete_tag', { id });
}

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

export async function getCites(fromId: string, toId: string): Promise<Cites[]> {
  return await invoke('get_cites', { fromId, toId });
}

export async function createCite(fromId: string, toId: string, data: Cites): Promise<Cites> {
  return await invoke('create_cite', { fromId, toId, data });
}

export async function deleteCite(id: string): Promise<void> {
  return await invoke('delete_cite', { id });
}
