import type { CalendarData, CalendarDateParts } from '@/services/Calendars/calendar.types';

export interface StoryOriginDateDto {
  era_index: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface Tab4PlaygroundProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab4PlaygroundEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
