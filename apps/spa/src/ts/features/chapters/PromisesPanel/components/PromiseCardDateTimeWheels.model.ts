export interface PromiseCardDateTimeWheelsProps {
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
}

export type PromiseCardDateTimeWheelsEmits = {
  (e: 'update:currentEraIdx', val: number): void;
    (e: 'update:currentYear', val: number): void;
    (e: 'update:currentMonthIdx', val: number): void;
    (e: 'update:currentDay', val: number): void;
    (e: 'update:currentHour', val: number): void;
    (e: 'update:currentMinute', val: number): void;
    (e: 'change'): void;
};
