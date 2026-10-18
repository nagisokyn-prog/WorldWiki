/**
 * @file PlanetEditor.model.ts
 * @description Типы, пропсы и события компонента редактирования планеты.
 */

import type { PlanetEntity, MoonConfig, WorldRegion, WorldTimezone, CalendarData } from '../../../../services/Calendars/calendar.types';

export interface PlanetCalendarOption {
  id?: string;
  name?: string;
  data: CalendarData;
}

export interface PlanetEditorProps {
  planet: PlanetEntity;
  calendars?: PlanetCalendarOption[];
}

export interface PlanetEditorEmits {
  (e: 'update:planet', val: PlanetEntity): void;
  (e: 'save', val: PlanetEntity): void;
  (e: 'delete', id: string): void;
}

export interface AstronomicalPoints {
  winterSolstice: number;
  springEquinox: number;
  summerSolstice: number;
  autumnEquinox: number;
}

export type { PlanetEntity, MoonConfig, WorldRegion, WorldTimezone };

