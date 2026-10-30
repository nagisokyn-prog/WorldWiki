import type { DstPolicyConfig, DstTransitionRule, WeekdayOccurrence } from '../Tab5ReformsDst.model'

export interface Tab5DstTransitionRulesProps {
  policyConfig: DstPolicyConfig;
    monthNames: string[];
    weekdayNames: string[];
    isReadOnly?: boolean;
}

export type Tab5DstTransitionRulesEmits = {
  (e: 'update-spring-rule', patch: Partial<DstTransitionRule>): void;
    (e: 'update-autumn-rule', patch: Partial<DstTransitionRule>): void;
};
