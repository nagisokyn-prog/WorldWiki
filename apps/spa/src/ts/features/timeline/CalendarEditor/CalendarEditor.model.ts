import type { CalendarRecord } from '@/stores/calendar.store';

export type CalendarEditorTab =
  | 'structure'
  | 'astronomy'
  | 'chronology'
  | 'syncLeap'
  | 'reformsDst';

export interface CalendarEditorProps {
  calendarId: string;
  projectId: string;
  planetId?: string;
  isReadOnly?: boolean;
}

export interface TabItem {
  id: CalendarEditorTab;
  label: string;
  icon: string;
  badge?: string;
  isWarning?: boolean;
}

export type CalendarEditorEmits = {
  (e: 'update:calendar', calendar: CalendarRecord): void;
  (e: 'save', calendar: CalendarRecord): void;
  (e: 'delete', calendarId: string): void;
  (e: 'audit', calendarId: string): void;
};
