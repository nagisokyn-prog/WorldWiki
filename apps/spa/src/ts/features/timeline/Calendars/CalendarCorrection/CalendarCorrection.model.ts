/**
 * @file CalendarCorrection.model.ts
 * @description Модели данных для единого компонента календарной коррекции (високосы и дни вне месяцев).
 */

import type { CalendarData, LeapHarmonic } from '../../../../services/Calendars/calendar.types';

export interface CalendarCorrectionProps {
  modelValue: CalendarData;
}

export interface CalendarCorrectionEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}

export interface LeapSuggestion {
  leapYears: number;
  cycleYears: number;
  label: string;
  driftPerCentury: number;
  description: string;
  rulePreset?: 'gregorian' | 'simple_4' | 'custom';
  harmonics?: LeapHarmonic[];
}

export type LeapRulePreset = 'gregorian' | 'simple_4' | 'custom' | 'none';

export type ExtraDaysPlacement = 'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month';

export interface UpcomingLeapYear {
  year: number;
  isLeap: boolean;
  daysAdded: number;
}

export interface YearTimelineItem {
  id: string;
  type: 'month' | 'extra_days';
  name: string;
  days: number;
  leapDaysAdded?: number;
  isLeapTarget?: boolean;
  monthIndex?: number;
}

export interface HarmonicRow {
  id: string;
  weight: number;
  divisor: number;
  label?: string;
}
