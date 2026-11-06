import type {
  DualDatingInput,
  DualDatingResult,
  GapReformParams,
  ReformMode,
  ReformPresetKey,
  ResetReformParams,
  TransitionalReformParams,
} from '../../Tab5ReformsDst.model'

export interface Tab5ReformsSectionProps {
  mode: ReformMode;
    modeBadgeText: string;
    activePreset: ReformPresetKey | null;
    presets: Array<{ key: ReformPresetKey; label: string }>;
    monthNames: string[];
    gapParams: GapReformParams;
    transParams: TransitionalReformParams;
    resetParams: ResetReformParams;
    newStyleFirstDayStr: string;
    visualTapeStart: string;
    visualTapeMiddle: string;
    visualTapeEnd: string;
    dualDatingInput: DualDatingInput;
    dualDatingResult: DualDatingResult;
    isReadOnly?: boolean;
}

export type Tab5ReformsSectionEmits = {
  (e: 'select-preset', key: ReformPresetKey): void;
    (e: 'update-mode', mode: ReformMode): void;
    (e: 'update-gap', patch: Partial<GapReformParams>): void;
    (e: 'update-trans', patch: Partial<TransitionalReformParams>): void;
    (e: 'update-reset', patch: Partial<ResetReformParams>): void;
    (e: 'update-dual-input', patch: Partial<DualDatingInput>): void;
};
