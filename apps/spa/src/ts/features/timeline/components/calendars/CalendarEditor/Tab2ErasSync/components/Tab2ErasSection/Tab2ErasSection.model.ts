import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type { ExtendedEraDto } from '../../Tab2ErasSync.model'

export interface Tab2ErasSectionProps {
  eras: ExtendedEraDto[];
    months: CalendarMonth[];
    isReadOnly?: boolean;
}

export type Tab2ErasSectionEmits = {
  (e: 'add-era'): void;
    (e: 'update-eras', eras: ExtendedEraDto[]): void;
    (e: 'remove-era', idx: number): void;
    (e: 'reorder-era', idx: number, dir: -1 | 1): void;
};
