import type { CalendarEra } from '@/services/Calendars/calendar.types'
import type { SyncDirection } from '../../Tab2ErasSync.model'

export interface Tab2SyncEraFormProps {
  selectedMasterEraIndex: number;
    masterEras: CalendarEra[];
    offsetDirection: SyncDirection;
    offsetYears: number;
    isReadOnly?: boolean;
}

export type Tab2SyncEraFormEmits = {
  (e: 'update-master-era', eraIdx: number): void;
    (e: 'update-offset-direction', dir: SyncDirection): void;
    (e: 'update-offset-years', years: number): void;
};
