import type { MonthMatrixDayDto } from '../Tab4Playground.model'

export interface Tab4MatrixSectionProps {
  currentMonthTitle: string;
    weekdayHeaders: string[];
    monthMatrixDays: MonthMatrixDayDto[];
}

export type Tab4MatrixSectionEmits = {
  (e: 'prev-month'): void;
    (e: 'next-month'): void;
    (e: 'select-day', day: number): void;
};
