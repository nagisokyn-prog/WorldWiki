import type { CalendarData } from '@/services/Calendars/calendar.types';

export type CalendarPresetCategory = 'real_world' | 'fantasy';

export interface CalendarPreset {
  id: string;
  name: string;
  category: CalendarPresetCategory;
  categoryLabel: string;
  description: string;
  icon: string;
  authorOrLore: string;
  totalDays: number;
  monthsCount: number;
  weekDaysCount: number;
  holidaysCount: number;
  data: Partial<CalendarData>;
}

