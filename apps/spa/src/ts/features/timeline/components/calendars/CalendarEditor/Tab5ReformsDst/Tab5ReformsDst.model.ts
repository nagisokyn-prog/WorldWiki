/**
 * @file Tab5ReformsDst.model.ts
 * @description Модели данных для вкладки исторических реформ календаря и сезонного перевода стрелок (DST).
 */

import type { CalendarData } from '@/services/Calendars/calendar.types';

export type ReformPresetKey =
  | 'gregorian_1582'
  | 'caesar_46bc'
  | 'russia_1918'
  | 'french_1792'
  | 'fantasy_magic';

export type ReformMode = 'gap' | 'transitional' | 'reset';

export interface GapReformParams {
  oldDay: number;
  oldMonth: number;
  oldYear: number;
  droppedDays: number;
}

export interface TransitionalReformParams {
  transitionalYear: number;
  addedDays: number;
}

export interface ResetReformParams {
  resetDay: number;
  resetMonth: number;
  resetYearOld: number;
  resetToYear: number;
}

export interface DualDatingInput {
  day: number;
  month: number;
  year: number;
}

export interface DualDatingResult {
  osDateStr: string;
  nsDateStr: string;
  mabsMinutes: number;
  quoteStr: string;
}

export type DstPresetKey =
  | 'eu_standard'
  | 'us_standard'
  | 'fixed_dates'
  | 'fantasy_harvest'
  | 'none';

export type DstPolicyType = 'relative' | 'fixed' | 'none';

export type WeekdayOccurrence = 'first' | 'second' | 'third' | 'fourth' | 'last';

export interface DstTransitionRule {
  month: number;
  occurrence: WeekdayOccurrence;
  weekday: number;
  fixedDay: number;
  time: string;
}

export interface DstPolicyConfig {
  isEnabled: boolean;
  policy: DstPolicyType;
  shiftMinutes: number;
  springRule: DstTransitionRule;
  autumnRule: DstTransitionRule;
}

export interface CalendarReform {
  id?: string;
  name: string;
  effective_year: number;
  mode: ReformMode;
  skipped_days?: number;
  transitional_days?: number;
  description?: string;
}

export interface Tab5ReformsDstProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab5ReformsDstEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
