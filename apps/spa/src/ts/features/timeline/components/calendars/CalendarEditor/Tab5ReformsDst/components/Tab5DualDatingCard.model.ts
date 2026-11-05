import type { DualDatingInput, DualDatingResult } from '../Tab5ReformsDst.model'

export interface Tab5DualDatingCardProps {
  monthNames: string[];
    dualDatingInput: DualDatingInput;
    dualDatingResult: DualDatingResult;
    isReadOnly?: boolean;
}

export type Tab5DualDatingCardEmits = {
  (e: 'update-dual-input', patch: Partial<DualDatingInput>): void;
};
