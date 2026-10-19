import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarLeapSettings {
  тип_правила: string;
  интервал?: number;
  дней_добавлять?: number;
  [key: string]: unknown;
}

export interface Tab4SyncLeapProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab4SyncLeapEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
