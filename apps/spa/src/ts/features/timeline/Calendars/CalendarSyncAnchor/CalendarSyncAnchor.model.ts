/**
 * @file CalendarSyncAnchor.model.ts
 * @description Типы, пропсы и контракты сопряжения культурного календаря с Опорным Календарем Мира.
 */

import type { CalendarData, CalendarEra, CalendarMonth, SyncAnchorDate } from '../../../../services/Calendars/calendar.types';

export interface CalendarSyncAnchorProps {
  modelValue: CalendarData;
  masterCalendar?: CalendarData | null;
  availableCalendars?: CalendarData[];
}

export type SyncDirection = 'after' | 'before';
export type SyncTargetType = 'event' | 'calendar' | 'master_era';

export interface SyncAnchorState {
  syncTargetType: SyncTargetType;
  selectedMasterEraIndex: number; // -1 = От начала Календаря Мира
  selectedEventId: string;
  selectedCalendarId: string;
  targetCalendarYear: number;
  syncDirection: SyncDirection;   // 'after' = после события/эпохи, 'before' = до
  offsetYears: number;            // Положительное число лет
}

export type { CalendarData, CalendarEra, CalendarMonth, SyncAnchorDate };
