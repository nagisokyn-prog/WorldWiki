/**
 * @file CalendarGeography.model.ts
 * @description Модель и типы привязки регионов/городов и часовых поясов планеты к календарю культуры.
 */

import type { CalendarData, PlanetEntity, WorldRegion, WorldTimezone } from '../../../../services/Calendars/calendar.types';

export interface CalendarGeographyProps {
  modelValue: CalendarData;
  planet?: PlanetEntity | null;
}

export interface CalendarGeographyEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}

export type { CalendarData, PlanetEntity, WorldRegion, WorldTimezone };
