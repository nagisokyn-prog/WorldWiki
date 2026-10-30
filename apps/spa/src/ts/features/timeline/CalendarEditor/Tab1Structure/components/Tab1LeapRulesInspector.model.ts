import type { CalendarMonth } from '@/services/Calendars/calendar.types'
import type { HarmonicRule, LeapRuleType } from '../Tab1Structure.model'
import type { UpcomingYearDto } from '../tab1Leap.utils'

export interface Tab1LeapRulesInspectorProps {
  ruleType: LeapRuleType;
    leapOffset: number;
    targetMode: 'in_month' | 'in_extra_days';
    targetMonthIndex: number;
    targetMonthPreview: string;
    months: CalendarMonth[];
    harmonics: HarmonicRule[];
    customDriftLabel: string;
    customDriftIsOk: boolean;
    baseYearDays: number;
    upcomingYears: UpcomingYearDto[];
    isReadOnly?: boolean;
}

export type Tab1LeapRulesInspectorEmits = {
  (e: 'update-leap-offset', val: number): void;
    (e: 'update-target-mode', val: 'in_month' | 'in_extra_days'): void;
    (e: 'update-target-month', val: number): void;
    (e: 'update-harmonic-period', idx: number, period: number): void;
    (e: 'remove-harmonic', idx: number): void;
    (e: 'add-harmonic', weight: number, defaultPeriod: number): void;
};
