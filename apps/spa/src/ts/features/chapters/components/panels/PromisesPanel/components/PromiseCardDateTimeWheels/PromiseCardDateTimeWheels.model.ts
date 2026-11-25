import type { DatePrecision } from '@/types/narrative';

export interface PromiseCardDateTimeWheelsProps {
  datePrecision?: DatePrecision;
  currentEraIdx: number;
  currentYear: number;
  currentMonthIdx: number;
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  endYear?: number;
  endMonthIdx?: number;
  currentSeasonIdx?: number;
  eraWheelOptions: Array<{ value: number; label: string }>;
  yearWheelOptions: Array<{ value: number; label: string }>;
  monthWheelOptions: Array<{ value: number; label: string }>;
  dayWheelOptions: Array<{ value: number; label: string }>;
  hourWheelOptions: Array<{ value: number; label: string }>;
  minuteWheelOptions: Array<{ value: number; label: string }>;
  seasonWheelOptions?: Array<{ value: number; label: string }>;
  eraMinYear?: number;
  eraMaxYear?: number;
}

export type PromiseCardDateTimeWheelsEmits = {
  (e: 'update:currentEraIdx', val: number): void;
  (e: 'update:currentYear', val: number): void;
  (e: 'update:currentMonthIdx', val: number): void;
  (e: 'update:currentDay', val: number): void;
  (e: 'update:currentHour', val: number): void;
  (e: 'update:currentMinute', val: number): void;
  (e: 'update:endYear', val: number): void;
  (e: 'update:endMonthIdx', val: number): void;
  (e: 'update:currentSeasonIdx', val: number): void;
  (e: 'change'): void;
};
