import type {
  DstPolicyConfig,
  DstPolicyType,
  DstPresetKey,
  DstTransitionRule,
} from '../../Tab5ReformsDst.model'

export interface Tab5DstSectionProps {
  policyConfig: DstPolicyConfig;
    policyBadgeText: string;
    shiftBadgeText: string;
    shiftSelectVal: string;
    activePreset: DstPresetKey | null;
    presets: Array<{ key: DstPresetKey; label: string }>;
    monthNames: string[];
    weekdayNames: string[];
    simTab: 'spring' | 'autumn';
    springSliderVal: number;
    autumnSliderVal: number;
    autumnFold: number;
    springTimeStr: string;
    autumnTimeStr: string;
    springAlertTitle: string;
    springAlertDesc: string;
    springAlertStyle: Record<string, string>;
    springAlertTextColor: string;
    autumnAlertDesc: string;
    autumnAlertStyle: Record<string, string>;
    isReadOnly?: boolean;
}

export type Tab5DstSectionEmits = {
  (e: 'select-preset', key: DstPresetKey): void;
    (e: 'update-policy-type', policy: DstPolicyType): void;
    (e: 'update-shift-select', val: string): void;
    (e: 'update-shift-minutes', val: number): void;
    (e: 'update-spring-rule', patch: Partial<DstTransitionRule>): void;
    (e: 'update-autumn-rule', patch: Partial<DstTransitionRule>): void;
    (e: 'switch-sim-tab', tab: 'spring' | 'autumn'): void;
    (e: 'update-spring-slider', val: number): void;
    (e: 'update-autumn-slider', val: number): void;
    (e: 'update-autumn-fold', val: number): void;
};
