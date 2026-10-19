import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarOrigin {
  эпоха?: number;
  год: number;
  месяц: number;
  день: number;
  день_недели?: number;
  [key: string]: unknown;
}

export interface Tab3ChronologyProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab3ChronologyEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
