/**
 * @file CalendarExtraDays.model.ts
 * @description Модели для компонента настройки дополнительных дней (эпагоменов).
 */

import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarExtraDaysProps {
  modelValue: CalendarData;
}

export interface CalendarExtraDaysEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}
