/**
 * @file CalendarEditor.model.ts
 * @description Модель данных и типы для главного контейнера редактирования календаря (Calendar View)
 */

export type CalendarEditorTab =
  | 'timeGrid'
  | 'erasSync'
  | 'cultureLore'
  | 'playground'
  | 'reformsDst';

export interface CalendarTabInfo {
  id: CalendarEditorTab;
  label: string;
  icon: string;
  badge?: string;
  isWarning?: boolean;
}

export interface CalendarEditorProps {
  calendarId: string | null;
  projectId: string;
  isReadOnly?: boolean;
}

export type CalendarEditorEmits = {
  (e: 'update:calendar', data: Record<string, unknown>): void;
  (e: 'save', data: Record<string, unknown>): void;
  (e: 'delete', id: string): void;
};
