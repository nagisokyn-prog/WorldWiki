import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarMoon {
  name: string;
  period_days?: number;
  [key: string]: unknown;
}

export interface CalendarPlanetPhysics {
  орбитальный_период: number;
  наклон_оси: number;
  [key: string]: unknown;
}

export interface Tab2AstronomyProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab2AstronomyEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
