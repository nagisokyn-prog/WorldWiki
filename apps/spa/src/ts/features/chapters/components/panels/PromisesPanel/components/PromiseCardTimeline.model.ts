import type { DiegeticDateBadgeInfo } from './PromiseCardMeta.model'
import type { CalendarRecord } from '@/stores/calendar.store'

export interface PromiseCardTimelineProps {
  isDatePickerOpen: boolean;
  diegeticInfo: DiegeticDateBadgeInfo | null;
  calendars?: CalendarRecord[];
  currentCalendarId?: string;
  currentTimeNature?: string;
  currentEraIdx: number;
  currentYear: number;
  currentMonthIdx: number;
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  eraWheelOptions: Array<{ value: number; label: string }>;
  yearWheelOptions: Array<{ value: number; label: string }>;
  monthWheelOptions: Array<{ value: number; label: string }>;
  dayWheelOptions: Array<{ value: number; label: string }>;
  hourWheelOptions: Array<{ value: number; label: string }>;
  minuteWheelOptions: Array<{ value: number; label: string }>;
  eraMinYear?: number;
  eraMaxYear?: number;
}

export type PromiseCardTimelineEmits = {
  (e: 'toggle-picker'): void;
  (e: 'update:currentCalendarId', val: string): void;
  (e: 'update:currentTimeNature', val: string): void;
  (e: 'update:currentEraIdx', val: number): void;
    (e: 'update:currentYear', val: number): void;
    (e: 'update:currentMonthIdx', val: number): void;
    (e: 'update:currentDay', val: number): void;
    (e: 'update:currentHour', val: number): void;
    (e: 'update:currentMinute', val: number): void;
    (e: 'change'): void;
};
