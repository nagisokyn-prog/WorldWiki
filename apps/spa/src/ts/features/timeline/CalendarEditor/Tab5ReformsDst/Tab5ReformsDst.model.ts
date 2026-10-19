import type { CalendarData } from '@/services/Calendars/calendar.types';

export type ReformMode = 'DiscontinuousGap' | 'TransitionalYear' | 'EpochReset';

export interface CalendarReform {
  id?: string;
  name: string;
  effective_year: number;
  mode: ReformMode;
  skipped_days?: number;
  gap_start_day?: number;
  transitional_days?: number;
  description?: string;
}

export interface DstPolicy {
  is_enabled: boolean;
  spring_shift_minutes: number;
  autumn_shift_minutes: number;
  spring_month?: number;
  spring_day?: number;
  autumn_month?: number;
  autumn_day?: number;
}

export interface Tab5ReformsDstProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab5ReformsDstEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
