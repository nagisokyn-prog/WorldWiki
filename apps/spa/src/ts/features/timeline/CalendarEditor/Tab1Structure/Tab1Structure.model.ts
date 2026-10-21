import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface CalendarWeekday {
  название: string;
}

export type DialPreset = 'earth' | 'fantasy' | 'metric' | 'agrarian';
export type WeekPreset = 7 | 6 | 10 | 5;
export type DayStartMode = 'midnight' | 'sunrise' | 'noon' | 'sunset' | 'custom';

export type LeapRuleType = 'gregorian' | 'simple' | 'custom' | 'none';
export type SystemPresetType = 'gregorian' | 'tolkien' | 'egyptian' | 'custom';

export interface HarmonicRule {
  weight: number;
  period: number;
}

export interface LeapRuleDto {
  interval: number;
  day_offset: number;
  target_month: number;
  exceptions?: number[];
}

export interface LeapSuggestionDto {
  key: string;
  ratio: string;
  desc: string;
  drift: string;
  isOk: boolean;
}

export interface Tab1StructureProps {
  calendarData: CalendarData | null;
  planetOrbitDays?: number;
  isReadOnly?: boolean;
}

export type Tab1StructureEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
