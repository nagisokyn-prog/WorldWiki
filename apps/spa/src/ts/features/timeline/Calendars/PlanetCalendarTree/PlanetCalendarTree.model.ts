/**
 * @file PlanetCalendarTree.model.ts
 * @description Модель и типы дерева планет и календарей.
 */

import type { PlanetEntity, CalendarData } from '../../../../services/Calendars/calendar.types';
export type { PlanetEntity, CalendarData };

export interface CalendarTreeItem {
  id?: string;
  idx: number;
  name: string;
  is_master?: boolean;
  planet_id: string;
  data: CalendarData;
}

export interface PlanetTreeGroup {
  planet: PlanetEntity;
  calendars: CalendarTreeItem[];
  isExpanded: boolean;
}

export interface PlanetCalendarTreeProps {
  planets: PlanetEntity[];
  calendars: Array<{
    id?: string;
    is_master?: boolean;
    data: CalendarData;
    [key: string]: unknown;
  }>;
  selectedId?: string; // 'planet:<id>' or 'cal:<idx>'
}

export interface PlanetCalendarTreeEmits {
  (e: 'select-planet', planet: PlanetEntity): void;
  (e: 'select-calendar', calIndex: number): void;
  (e: 'add-calendar', planetId: string): void;
  (e: 'add-planet'): void;
}
