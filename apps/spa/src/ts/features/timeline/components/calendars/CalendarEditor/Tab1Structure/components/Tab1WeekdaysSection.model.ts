import type { CalendarWeekday, WeekPreset } from '../Tab1Structure.model'

export interface Tab1WeekdaysSectionProps {
  weekdays: CalendarWeekday[];
    newWeekdayName: string;
    pauseOnHolidays?: boolean;
    isReadOnly?: boolean;
}

export type Tab1WeekdaysSectionEmits = {
  (e: 'apply-week-preset', preset: WeekPreset): void;
    (e: 'reorder-weekday', idx: number, dir: -1 | 1): void;
    (e: 'remove-weekday', idx: number): void;
    (e: 'update:new-weekday-name', name: string): void;
    (e: 'add-new-day'): void;
    (e: 'set-pause-on-holidays', val: boolean): void;
};
