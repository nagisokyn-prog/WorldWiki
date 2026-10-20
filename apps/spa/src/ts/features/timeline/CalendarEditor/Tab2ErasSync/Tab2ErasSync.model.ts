import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CoreEra } from '@worldwiki/calendar-wasm';

export interface AnchorEventDto {
  id?: string;
  name: string;
  year: number;
  month: number;
  day: number;
  description?: string;
}

export interface Tab2ErasSyncProps {
  calendarData: CalendarData | null;
  masterCalendarData?: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab2ErasSyncEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
