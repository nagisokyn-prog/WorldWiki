import type { AnchorEventDto } from '../Tab2ErasSync.model'

export interface Tab2AnchorEventsSectionProps {
  anchorEvents: AnchorEventDto[];
    isReadOnly?: boolean;
}

export type Tab2AnchorEventsSectionEmits = {
  (e: 'add-anchor-event', event: AnchorEventDto): void;
    (e: 'remove-anchor-event', idx: number): void;
};
