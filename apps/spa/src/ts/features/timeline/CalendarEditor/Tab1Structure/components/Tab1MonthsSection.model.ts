import type { CalendarMonth, CalendarSeason } from '@/services/Calendars/calendar.types';

export interface Tab1MonthsSectionProps {
  months: CalendarMonth[];
  totalYearDays: number;
  firstMonthOfYear?: number;
  newYearDay?: number;
  isReadOnly?: boolean;
  seasons?: CalendarSeason[];
}

export type Tab1MonthsSectionEmits = {
  (e: 'balance-months'): void;
  (e: 'add-month'): void;
  (e: 'update-months', months: CalendarMonth[]): void;
  (e: 'set-first-month', monthIndex: number): void;
  (e: 'set-new-year-day', day: number): void;
};
