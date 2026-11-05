import type { CalendarRecord } from '@/stores/calendar.store'
import type { CalendarData } from '@/services/Calendars/calendar.types'

export interface TimeAtlasMatrixTabProps {
  allCalendars: CalendarRecord[];
    matrixBaseCalId: string;
    matrixCompareCalId: string;
    matrixEra?: number;
    matrixYear: number;
    matrixMonth: number;
    matrixBaseCal: CalendarData | null;
    matrixGridDays: Array<{
      day: number;
      baseMin: number;
      isCurrent: boolean;
      compDateStr?: string;
      baseMeta: { holiday?: string | null; moons: Array<{ emoji: string; moon: { name: string }; name: string }> };
      compHoliday?: string | null;
    }>;
}

export type TimeAtlasMatrixTabEmits = {
  (e: 'update:matrixBaseCalId', value: string): void;
    (e: 'update:matrixCompareCalId', value: string): void;
    (e: 'update:matrixEra', value: number): void;
    (e: 'update:matrixYear', value: number): void;
    (e: 'update:matrixMonth', value: number): void;
    (e: 'prevMonth'): void;
    (e: 'nextMonth'): void;
    (e: 'selectDay', baseMin: number): void;
};
