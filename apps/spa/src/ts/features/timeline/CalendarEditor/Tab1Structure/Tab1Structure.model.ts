import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarWeekday {
  название: string;
}

export interface Tab1StructureProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab1StructureEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
