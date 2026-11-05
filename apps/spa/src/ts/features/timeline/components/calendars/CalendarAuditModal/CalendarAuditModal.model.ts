/**
 * @file CalendarAuditModal.model.ts
 * @description Модели и интерфейсы для модального окна аудита календаря.
 */

import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarAuditModalProps {
  modelValue: boolean;
  calendar: CalendarData;
}

export interface CalendarAuditModalEmits {
  (e: 'update:modelValue', val: boolean): void;
}
