import type { CalendarPreset, CalendarPresetCategory } from '@/features/timeline/components/calendars/presets/presets.model';

export interface CalendarPresetsModalProps {
  modelValue: boolean;
}

export interface CalendarPresetsModalEmits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select-preset', preset: CalendarPreset): void;
}

export type CategoryFilter = 'all' | CalendarPresetCategory;

