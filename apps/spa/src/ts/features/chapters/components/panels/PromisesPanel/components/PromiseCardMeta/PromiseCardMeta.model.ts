import type { RichPlotPromise } from '../../usePromisesPanel';
import type { CalendarRecord } from '@/stores/calendar.store';

export interface SharedPromiseEntities {
  calendars: CalendarRecord[];
  locations: ProjectEntityOption[];
  characters: ProjectEntityOption[];
  timelineEvents: TimelineEventOption[];
}

export interface PromiseCardMetaProps {
  project: string;
  item: RichPlotPromise;
  chapterId?: string | null;
  previousScene?: RichPlotPromise | null;
  sharedEntities?: SharedPromiseEntities | null;
}

export interface PromiseCardMetaEmits {
  (e: 'update:item', item: RichPlotPromise): void;
  (e: 'change'): void;
}

export interface ProjectEntityOption {
  id: string;
  name: string;
  type?: string;
}

export interface TimelineEventOption {
  id: string;
  title: string;
  m_abs?: number;
  m_abs_end?: number | null;
  date_precision?: string | null;
  is_approximate?: boolean | null;
  time_of_day?: string | null;
}

export interface DialDeltaChip {
  label: string;
  title: string;
  deltaMinutes: number;
}

export interface DiegeticDateBadgeInfo {
  calendarName: string;
  seasonName: string;
  seasonClass: string;
  timeOfDayName: string;
  formattedDate: string;
  mAbs: number;
}

export interface PromiseCardLocationRowProps {
  locationDraft: string;
  isEntityLocation: boolean;
  hasLocationId: boolean;
  isDropdownOpen: boolean;
  filteredLocations: ProjectEntityOption[];
  hasPreviousScene: boolean;
  blockBadgeText: string | null;
}

export interface PromiseCardLocationRowEmits {
  (e: 'update:locationDraft', val: string): void;
  (e: 'open-dropdown'): void;
  (e: 'close-dropdown'): void;
  (e: 'blur'): void;
  (e: 'select', val: string): void;
  (e: 'clear'): void;
  (e: 'copy-context'): void;
}
