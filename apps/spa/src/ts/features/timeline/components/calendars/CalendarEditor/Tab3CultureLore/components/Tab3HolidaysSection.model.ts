import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type { CultureHolidayDto } from '../Tab3CultureLore.model'

export interface Tab3HolidaysSectionProps {
  holidays: CultureHolidayDto[];
    months: CalendarMonth[];
    isReadOnly?: boolean;
}

export type Tab3HolidaysSectionEmits = {
  (e: 'add-holiday'): void;
    (e: 'update-holidays', list: CultureHolidayDto[]): void;
    (e: 'remove-holiday', idx: number): void;
};
