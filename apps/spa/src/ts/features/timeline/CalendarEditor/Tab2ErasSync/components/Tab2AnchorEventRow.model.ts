import type { AnchorEventDto } from '../Tab2ErasSync.model';

export interface Tab2AnchorEventRowProps {
  ev: AnchorEventDto;
  idx: number;
  isReadOnly?: boolean;
}

export type Tab2AnchorEventRowEmits = {
  (e: 'field-change', idx: number, field: keyof AnchorEventDto, value: unknown): void;
  (e: 'remove', idx: number): void;
};

