/**
 * @file CalendarAnchorEvents.model.ts
 * @description Модель и контракты опорных исторических событий (вех мира) для Мастер-календаря.
 */

import type { CalendarData, CalendarAnchorEvent } from '../../../../services/Calendars/calendar.types';

export interface CalendarAnchorEventsProps {
  modelValue: CalendarData;
}

export interface CalendarAnchorEventsEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}

export type { CalendarData, CalendarAnchorEvent };
