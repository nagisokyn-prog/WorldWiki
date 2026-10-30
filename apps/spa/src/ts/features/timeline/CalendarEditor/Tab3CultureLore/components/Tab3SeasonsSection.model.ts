import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type { CultureSeasonDto } from '../Tab3CultureLore.model'

export interface Tab3SeasonsSectionProps {
  seasons: CultureSeasonDto[];
    months: CalendarMonth[];
    isReadOnly?: boolean;
}

export type Tab3SeasonsSectionEmits = {
  (e: 'add-season'): void;
    (e: 'update-seasons', list: CultureSeasonDto[]): void;
    (e: 'remove-season', idx: number): void;
};
