import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../../services/Calendars/calendar.types'

export interface BridgeMappingCardProps {
  calData?: CalendarData | null;
    localDate?: CalendarDate['original_input'] | null;
    dateMeta?: {
      season: string;
      holiday: string | null;
      moons: MoonPhaseResult[];
    } | null;
    isMaster?: boolean;
}

export type BridgeMappingCardEmits = {
  (e: 'era-change', cal: CalendarData, ev: Event): void;
    (e: 'year-change', cal: CalendarData, ev: Event): void;
    (e: 'month-change', cal: CalendarData, ev: Event): void;
    (e: 'day-change', cal: CalendarData, ev: Event): void;
};
