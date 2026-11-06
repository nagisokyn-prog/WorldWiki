import type { DialUnit } from '@/services/Calendars/calendar.types'
import type { DialPreset, DayStartMode } from '../../Tab1Structure.model'

export interface Tab1DialSectionProps {
  dialUnits: DialUnit[];
    dayStartOffset: string;
    isReadOnly?: boolean;
}

export type Tab1DialSectionEmits = {
  (e: 'apply-preset', preset: DialPreset): void;
    (e: 'set-day-start-offset', mode: DayStartMode): void;
};
