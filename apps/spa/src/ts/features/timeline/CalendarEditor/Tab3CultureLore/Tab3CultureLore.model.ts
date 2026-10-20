import type { CalendarData, CalendarSeason, CalendarHoliday } from '@/services/Calendars/calendar.types';

export interface CultureMoonPhaseDto {
  name: string;
  phase_index: number; // 0..7
  description?: string;
}

export interface CharacterAgeRuleDto {
  mode: 'tropical_years' | 'earth_standard_equivalent' | 'custom_ratio';
  ratio_to_earth: number;
  step_on_new_year: boolean;
  age_at_birth: number;
}

export interface Tab3CultureLoreProps {
  calendarData: CalendarData | null;
  isReadOnly?: boolean;
}

export type Tab3CultureLoreEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
