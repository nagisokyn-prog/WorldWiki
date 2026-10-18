/**
 * @file CalendarSyncAnchor.model.ts
 * @description Типы, пропсы и контракты сопряжения культурного календаря с Опорным Календарем Мира.
 */

import type { CalendarData, CalendarEra, CalendarMonth, SyncAnchorDate } from '../../../../services/Calendars/calendar.types';

export interface CalendarSyncAnchorProps {
  modelValue: CalendarData;
  masterCalendar?: CalendarData | null;
}

export type SyncDirection = 'after' | 'before';

export interface SyncAnchorState {
  selectedMasterEraIndex: number; // -1 = От начала Календаря Мира
  syncDirection: SyncDirection;   // 'after' = после эпохи, 'before' = до эпохи
  offsetYears: number;            // Положительное число лет
}

export type { CalendarData, CalendarEra, CalendarMonth, SyncAnchorDate };
