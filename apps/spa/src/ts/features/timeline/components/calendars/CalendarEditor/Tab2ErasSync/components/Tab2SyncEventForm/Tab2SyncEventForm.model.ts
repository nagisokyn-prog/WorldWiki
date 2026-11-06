import type { AnchorEventDto, SyncDirection } from '../../Tab2ErasSync.model'

export interface Tab2SyncEventFormProps {
  selectedEventId: string;
    anchorEvents: AnchorEventDto[];
    currentEvent: AnchorEventDto | undefined;
    offsetDirection: SyncDirection;
    offsetYears: number;
    isReadOnly?: boolean;
}

export type Tab2SyncEventFormEmits = {
  (e: 'add-new-event'): void;
    (e: 'update-selected-event', id: string): void;
    (e: 'update-offset-direction', dir: SyncDirection): void;
    (e: 'update-offset-years', years: number): void;
    (e: 'save-current-event', event: AnchorEventDto): void;
};
