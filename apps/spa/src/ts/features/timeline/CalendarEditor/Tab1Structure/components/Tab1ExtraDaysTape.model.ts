import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type { YearTapeItem } from '../tab1Leap.utils'

export interface Tab1ExtraDaysTapeProps {
  extraDaysCount: number;
    extraDaysName: string;
    placement: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month';
    afterMonthIndex: number;
    pauseWeekdays: boolean;
    months: CalendarMonth[];
    yearTape: YearTapeItem[];
    isReadOnly?: boolean;
}

export type Tab1ExtraDaysTapeEmits = {
  (e: 'update-extra-days', val: number): void;
    (e: 'update-extra-name', val: string): void;
    (e: 'update-placement', val: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month'): void;
    (e: 'update-after-month', val: number): void;
    (e: 'update-pause-weekdays', val: boolean): void;
};
