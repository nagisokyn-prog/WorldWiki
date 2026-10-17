/**
 * @file CalendarPlanetPhysics.model.ts
 * @description Модели для компонента планетарной физики календаря.
 */

import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarPlanetPhysicsProps {
  modelValue: CalendarData;
}

export interface CalendarPlanetPhysicsEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}
