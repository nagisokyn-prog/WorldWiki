import type { CalendarPreset, CalendarPresetCategory } from '../presets/presets.model';

export interface CalendarPresetsModalProps {
  modelValue: boolean;
}

export interface CalendarPresetsModalEmits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select-preset', preset: CalendarPreset): void;
}

export type CategoryFilter = 'all' | CalendarPresetCategory;

