import type { CalendarData, CalendarSeason, CalendarHoliday } from '@/services/Calendars/calendar.types';

export interface CultureSeasonDto extends CalendarSeason {
  цвет?: string;
  hemisphere?: 'northern' | 'southern';
  месяцы: number[];
}

export interface CultureHolidayDto extends CalendarHoliday {
  is_range?: boolean;
  дата_конца?: { месяц: number; день: number };
  описание?: string;
}

export interface CultureMoonPhaseDto {
  name: string;
  phase_index: number;
  description?: string;
}

export interface CharacterAgeRuleDto {
  age_at_birth: number; // 0 or 1
  step_on_new_year: boolean;
  year_only: boolean;
}

export interface Tab3CultureLoreProps {
  calendarData: CalendarData | null;
  projectId?: string;
  planetId?: string;
  isReadOnly?: boolean;
}

export type Tab3CultureLoreEmits = {
  (e: 'update', patch: Partial<CalendarData>): void;
};
