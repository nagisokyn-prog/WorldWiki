import type { CalendarEra, CalendarMonth } from '@/services/Calendars/calendar.types'
import type { AnchorEventDto, SyncDirection, SyncTargetType } from '../Tab2ErasSync.model'

export interface Tab2SyncSectionProps {
  isMaster: boolean;
    syncType: SyncTargetType;
    selectedEventId: string;
    anchorEvents: AnchorEventDto[];
    currentEvent: AnchorEventDto | undefined;
    offsetDirection: SyncDirection;
    offsetYears: number;
    targetCalendarId: string;
    targetCalendarYear: number;
    selectedMasterEraIndex: number;
    masterEras: CalendarEra[];
    masterMonths: CalendarMonth[];
    anchorMonth: number;
    anchorDay: number;
    syncDescription: string;
    isReadOnly?: boolean;
}

export type Tab2SyncSectionEmits = {
  (e: 'update-sync-type', type: SyncTargetType): void;
    (e: 'add-new-event'): void;
    (e: 'update-selected-event', id: string): void;
    (e: 'update-offset-direction', dir: SyncDirection): void;
    (e: 'update-offset-years', years: number): void;
    (e: 'save-current-event', event: AnchorEventDto): void;
    (e: 'update-target-calendar', calId: string): void;
    (e: 'update-target-calendar-year', year: number): void;
    (e: 'update-master-era', eraIdx: number): void;
    (e: 'update-anchor-month', monthIdx: number): void;
    (e: 'update-anchor-day', day: number): void;
};
