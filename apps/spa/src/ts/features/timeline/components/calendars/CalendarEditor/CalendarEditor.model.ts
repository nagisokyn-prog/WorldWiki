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
  (e: 'update:name', name: string): void;
  (e: 'update:calendar', data: Record<string, unknown>): void;
  (e: 'save', data: Record<string, unknown>): void;
  (e: 'delete', id: string): void;
};

import type { CalendarData } from '@/services/Calendars/calendar.types';

export function buildCalendarTabsList(totalDays: number, calData: CalendarData | null): CalendarTabInfo[] {
  return [
    { id: 'timeGrid', label: 'Структура года', icon: '⏰', badge: `${totalDays} дн` },
    { id: 'erasSync', label: 'Летоисчисление и эры', icon: '🏛️', badge: calData?.эпохи ? `${calData.эпохи.length} эр` : undefined },
    { id: 'cultureLore', label: 'Традиции и культура', icon: '🎭', badge: calData?.праздники ? `${calData.праздники.length} праздн.` : undefined },
    { id: 'playground', label: 'Калькулятор дат сюжета', icon: '🧪', badge: 'Сюжет' },
    { id: 'reformsDst', label: 'Реформы и перевод часов', icon: '🔄', badge: 'Стиль' },
  ];
}
