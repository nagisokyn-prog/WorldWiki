import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CalendarSettingsProps {
  modelValue: CalendarData;
  isMaster?: boolean;
}
