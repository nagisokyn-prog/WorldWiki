import type { LoreDateExplanation } from '@/services/Calendars/calendar.types';

export interface GlobalCalendarWidgetProps {
  project: string;
}

export interface CalendarExplainerCardProps {
  dateExplanation: LoreDateExplanation;
  isCopied: boolean;
}

export interface CalendarExplainerCardEmits {
  (e: 'close'): void;
  (e: 'copy-snippet'): void;
}
