import type {
  LeapRuleType,
  SystemPresetType,
  LeapSuggestionDto,
} from '../../Tab1Structure.model'

export interface Tab1LeapPresetsProps {
  activeSystemPreset: SystemPresetType;
    ruleType: LeapRuleType;
    orbitDays: number;
    showSuggestions: boolean;
    suggestions: LeapSuggestionDto[];
    isReadOnly?: boolean;
}

export type Tab1LeapPresetsEmits = {
  (e: 'select-system-preset', preset: SystemPresetType): void;
    (e: 'select-rule-type', rule: LeapRuleType): void;
    (e: 'toggle-suggestions'): void;
    (e: 'apply-suggestion', key: string): void;
};
