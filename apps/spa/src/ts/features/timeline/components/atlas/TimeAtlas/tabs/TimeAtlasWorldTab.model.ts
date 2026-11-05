import type { WorldRegion, WorldTimezone, RegionSunStatus } from '@/services/Calendars/calendar.types';

export type WorldSliceFilter = 'all' | 'settlements' | 'capitals';

export interface WorldTimeSnapshotItem {
  region: WorldRegion;
  timezone?: WorldTimezone;
  offsetHours: number;
  localTimeStr: string;
  localDateFormatted: string;
  sunStatus: RegionSunStatus;
  entityId?: string;
  scale?: string;
  stateName?: string | null;
  isStateCapital?: boolean;
  isInherited?: boolean;
  inheritedFromName?: string | null;
}

export interface TimeAtlasWorldTabProps {
  worldTimeSnapshot: WorldTimeSnapshotItem[];
  worldSliceFilter?: WorldSliceFilter;
  worldTimeSnippet: string;
  isWorldTimeCopied: boolean;
  worldHour?: number;
  worldMinute?: number;
  masterCalendarName?: string;
  maxHours?: number;
  maxMinutes?: number;
  copyWorldTimeSnippet: () => Promise<void>;
  openLocationEntity?: (entityId: string) => void;
}

export type TimeAtlasWorldTabEmits = {
  (e: 'update:worldHour', val: number): void;
  (e: 'update:worldMinute', val: number): void;
  (e: 'update:worldSliceFilter', val: WorldSliceFilter): void;
};
