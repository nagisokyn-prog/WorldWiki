import type { CalendarData } from '@/services/Calendars/calendar.types';

export interface StoryOriginDateDto {
  era_index: number;
  year: number;
  month: number;
  day: number;
  weekday_index: number;
  hour: number;
  minute: number;
}

export interface MonthMatrixDayDto {
  day: number;
  weekdayName: string;
  weekdayShort: string;
  isHoliday: boolean;
  holidayName?: string;
  isSelected: boolean;
  isStoryOrigin: boolean;
}

export interface Tab4PlaygroundProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab4PlaygroundEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
