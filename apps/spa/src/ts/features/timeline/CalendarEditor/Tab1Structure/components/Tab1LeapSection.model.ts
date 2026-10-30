import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type {
  HarmonicRule,
  LeapRuleType,
  LeapSuggestionDto,
  SystemPresetType,
} from '../Tab1Structure.model'
import type { UpcomingYearDto, YearTapeItem } from '../tab1Leap.utils'

export interface Tab1LeapSectionProps {
  activeSystemPreset: SystemPresetType;
    ruleType: LeapRuleType;
    orbitDays: number;
    driftLabel: string;
    driftIsOk: boolean;
    showWarningBanner: boolean;
    totalNominalDays: number;
    monthsDaysSum: number;
    extraDaysCount: number;
    extraDaysName: string;
    placement: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month';
    afterMonthIndex: number;
    pauseWeekdays: boolean;
    months: CalendarMonth[];
    yearTape: YearTapeItem[];
    leapOffset: number;
    targetMode: 'in_month' | 'in_extra_days';
    targetMonthIndex: number;
    targetMonthPreview: string;
    harmonics: HarmonicRule[];
    upcomingYears: UpcomingYearDto[];
    suggestions: LeapSuggestionDto[];
    isReadOnly?: boolean;
}

export type Tab1LeapSectionEmits = {
  (e: 'select-system-preset', preset: SystemPresetType): void;
    (e: 'select-rule-type', rule: LeapRuleType): void;
    (e: 'apply-suggestion', key: string): void;
    (e: 'balance-months-extra'): void;
    (e: 'reset-extra-days'): void;
    (e: 'update-extra-days', val: number): void;
    (e: 'update-extra-name', val: string): void;
    (e: 'update-placement', val: 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month'): void;
    (e: 'update-after-month', val: number): void;
    (e: 'update-pause-weekdays', val: boolean): void;
    (e: 'update-leap-offset', val: number): void;
    (e: 'update-target-mode', val: 'in_month' | 'in_extra_days'): void;
    (e: 'update-target-month', val: number): void;
    (e: 'update-harmonic-period', idx: number, period: number): void;
    (e: 'remove-harmonic', idx: number): void;
    (e: 'add-harmonic', weight: number, defaultPeriod: number): void;
};
