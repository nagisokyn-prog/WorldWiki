import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarLeapYearProps {
  modelValue: Partial<CalendarData> & {
    правило_високосного_года?: string;
    пользовательское_високосное_правило?: {
      месяц: number;
      день_смещения: number;
      период?: number;
    };
    target_year_length_days?: number;
    [key: string]: unknown;
  };
}
