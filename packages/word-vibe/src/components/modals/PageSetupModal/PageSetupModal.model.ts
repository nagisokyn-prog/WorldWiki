import type { PageSize, Orientation, MarginsMm } from '../../../types/dto';

export interface PageSetupApplyPayload {
  margins: MarginsMm;
  pageSize: PageSize;
  orientation: Orientation;
}

export interface PageSetupModalProps {
  isOpen: boolean;
  margins?: MarginsMm;
  pageSize?: PageSize;
  orientation?: Orientation;
}

export type PageSetupModalEmits = {
  (e: 'close'): void;
  (e: 'apply', payload: PageSetupApplyPayload): void;
};

