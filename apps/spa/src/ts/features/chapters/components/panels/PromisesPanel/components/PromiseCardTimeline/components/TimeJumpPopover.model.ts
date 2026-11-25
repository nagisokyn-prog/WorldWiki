import type { DialDeltaChip } from '../../PromiseCardMeta/PromiseCardMeta.model';
import type { TimeJumpPreset } from '../timeJumpPresets';

export interface TimeJumpPopoverProps {
  dialDeltaChips: DialDeltaChip[];
}

export interface TimeJumpPopoverEmits {
  (e: 'apply', preset: Omit<TimeJumpPreset, 'id'>): void;
  (e: 'save-and-apply', preset: Omit<TimeJumpPreset, 'id'>): void;
  (e: 'close'): void;
}
