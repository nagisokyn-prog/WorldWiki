/**
 * @file DialHierarchyConstructor.model.ts
 * @description Модели для конструктора иерархии циферблата.
 */

import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface DialHierarchyConstructorProps {
  modelValue: CalendarData;
}

export interface DialHierarchyConstructorEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}
