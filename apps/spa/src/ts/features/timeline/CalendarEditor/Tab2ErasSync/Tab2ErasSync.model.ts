import type { CalendarData, CalendarEra } from '@/services/Calendars/calendar.types';

export type SyncTargetType = 'event' | 'calendar' | 'master_era';
export type SyncDirection = 'after' | 'before';

export interface ExtendedEraDto extends CalendarEra {
  has_anniversary?: boolean;
  anniversary_month?: number;
  anniversary_day?: number;
}

export interface AnchorEventDto {
  id?: string;
  name: string;
  year: number;
  month?: number;
  day?: number;
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
