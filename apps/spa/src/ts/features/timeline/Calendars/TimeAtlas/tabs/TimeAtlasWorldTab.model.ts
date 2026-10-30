import type { WorldRegion, WorldTimezone, RegionSunStatus } from '../../../../../services/Calendars/calendar.types'

export interface TimeAtlasWorldTabProps {
  worldTimeSnapshot: Array<{
      region: WorldRegion;
      timezone?: WorldTimezone;
      offsetHours: number;
      localTimeStr: string;
      localDateFormatted: string;
      sunStatus: RegionSunStatus;
    }>;
    worldTimeSnippet: string;
    isWorldTimeCopied: boolean;
    worldHour?: number;
    worldMinute?: number;
    masterCalendarName?: string;
    maxHours?: number;
    maxMinutes?: number;
    copyWorldTimeSnippet: () => Promise<void>;
}

export type TimeAtlasWorldTabEmits = {
  (e: 'update:worldHour', val: number): void;
    (e: 'update:worldMinute', val: number): void;
};
