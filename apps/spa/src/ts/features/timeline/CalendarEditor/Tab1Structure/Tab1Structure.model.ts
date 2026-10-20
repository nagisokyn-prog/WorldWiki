import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { DialUnit } from '@worldwiki/calendar-wasm';

export interface CalendarWeekday {
  название: string;
}

export type DialPreset = 'earth' | 'fantasy' | 'metric' | 'agrarian';
export type WeekPreset = 7 | 6 | 10 | 5;
export type DayStartMode = 'midnight' | 'sunrise' | 'noon' | 'sunset' | 'custom';

export interface LeapRuleDto {
  interval: number;
  day_offset: number;
  target_month: number;
  exceptions?: number[];
}

export interface Tab1StructureProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab1StructureEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
