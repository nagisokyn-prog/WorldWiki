import type { DiegeticDateBadgeInfo, DialDeltaChip } from '../PromiseCardMeta/PromiseCardMeta.model';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { DatePrecision, TimeOfDayPreset } from '@/types/narrative';
import type { TimeJumpPreset } from './timeJumpPresets';

export interface PromiseCardTimelineProps {
  project?: string;
  isDatePickerOpen: boolean;
  diegeticInfo: DiegeticDateBadgeInfo | null;
  calendars?: CalendarRecord[];
  currentCalendarId?: string;
  currentTimeNature?: string;
  datePrecision?: DatePrecision;
  isApproximate?: boolean;
  timeOfDay?: TimeOfDayPreset | null;
  hasPreviousDate?: boolean;
  dialDeltaChips?: DialDeltaChip[];
  seasonWheelOptions?: Array<{ value: number; label: string }>;
  currentSeasonIdx?: number;
  endYear?: number;
  endMonthIdx?: number;
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
  (e: 'copy-prev-date'): void;
  (e: 'shift-minutes', deltaMinutes: number): void;
  (e: 'shift-preset', preset: Omit<TimeJumpPreset, 'id'>): void;
  (e: 'select-time-of-day', preset: TimeOfDayPreset | null): void;
  (e: 'update:datePrecision', val: DatePrecision): void;
  (e: 'toggle-approximate'): void;
  (e: 'update:currentSeasonIdx', val: number): void;
  (e: 'update:endYear', val: number): void;
  (e: 'update:endMonthIdx', val: number): void;
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
