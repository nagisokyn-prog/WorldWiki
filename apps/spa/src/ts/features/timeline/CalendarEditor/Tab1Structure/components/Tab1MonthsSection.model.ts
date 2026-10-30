import type { CalendarMonth } from '@/services/Calendars/calendar.types'

export interface Tab1MonthsSectionProps {
  months: CalendarMonth[];
    totalYearDays: number;
    isReadOnly?: boolean;
}

export type Tab1MonthsSectionEmits = {
  (e: 'balance-months'): void;
    (e: 'add-month'): void;
    (e: 'update-months', months: CalendarMonth[]): void;
};
