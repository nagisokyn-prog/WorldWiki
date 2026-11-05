import type { CalendarRecord } from '@/stores/calendar.store';

export type CalendarAdapterMode = 'planet' | 'calendar';

export interface CalendarEntityAdapterProps {
  calendarId: string;
  projectId: string;
  initialData?: Record<string, unknown>;
  isPreview?: boolean;
}

export type CalendarEntityAdapterEmits = {
  (e: 'update:modelValue', value: Record<string, unknown>): void;
  (e: 'modified'): void;
  (e: 'save', calendar: CalendarRecord): void;
};
