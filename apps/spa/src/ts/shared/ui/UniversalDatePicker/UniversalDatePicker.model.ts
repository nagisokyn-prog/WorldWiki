import type { DatePickerModelValue } from './useUniversalDatePicker'

export interface UniversalDatePickerProps {
  project: string;
    modelValue?: DatePickerModelValue | string | null;
    showTime?: boolean;
}

export type UniversalDatePickerEmits = {
  (e: 'update:modelValue', val: unknown): void;
};
