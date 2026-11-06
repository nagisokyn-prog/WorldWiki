import type { MoonPhaseNames } from '@/services/Calendars/calendar.types'

export interface Tab3MoonPhasesSectionProps {
  phaseNames: MoonPhaseNames;
    isReadOnly?: boolean;
}

export type Tab3MoonPhasesSectionEmits = {
  (e: 'update-phase-names', names: MoonPhaseNames): void;
    (e: 'find-double-full-moon'): void;
};
