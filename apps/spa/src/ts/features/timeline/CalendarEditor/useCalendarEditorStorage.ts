/**
 * @file useCalendarEditorStorage.ts
 * @description Изолированный слой сохранения и восстановления драфта календаря в LocalStorage.
 */

export interface CalendarLocalState {
  activeTab?: string;
  unsavedData?: Record<string, unknown>;
  unsavedName?: string;
  timestamp?: number;
}

export function getCalendarStateKey(projectId?: string, calendarId?: string): string {
  const proj = (projectId || 'default').replace(/^projects:/, '');
  const calId = calendarId || 'cal_default';
  return `calendar-state-${proj}-${calId}`;
}

export function getCalendarScrollKey(projectId?: string, calendarId?: string): string {
  const proj = (projectId || 'default').replace(/^projects:/, '');
  const calId = calendarId || 'cal_default';
  return `calendar-scroll-${proj}-${calId}`;
}

export function saveCalendarLocalDraft(
  key: string,
  state: CalendarLocalState
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch (e: unknown) {
    console.warn('[CalendarEditorStorage] Ошибка сохранения состояния:', e);
  }
}

export function loadCalendarLocalDraft(key: string): CalendarLocalState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as CalendarLocalState;
    }
  } catch (e: unknown) {
    console.warn('[CalendarEditorStorage] Ошибка парсинга локального драфта:', e);
  }
  return null;
}

export function clearCalendarLocalDraft(stateKey: string, scrollKey?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(stateKey);
    if (scrollKey) {
      localStorage.removeItem(scrollKey);
    }
  } catch (e: unknown) {
    console.warn('[CalendarEditorStorage] Ошибка очистки локального состояния:', e);
  }
}

