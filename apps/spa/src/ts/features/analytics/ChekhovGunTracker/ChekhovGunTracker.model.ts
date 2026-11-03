import type {
  TrackedItem,
  ItemTrackerSummary,
  ItemJourneyReport,
  ItemJourneyNode,
  ItemUsageState,
  CustodyEvent,
} from '@/stores/analytics.store';

export type {
  TrackedItem,
  ItemTrackerSummary,
  ItemJourneyReport,
  ItemJourneyNode,
  ItemUsageState,
  CustodyEvent,
};

export type GunTrackerScope = 'guns' | 'items' | 'all';

export interface GunTrackerFilterState {
  search: string;
  itemType: string;
  usageState: string;
  scope: GunTrackerScope;
  selectedVolumeId?: string;
}

export interface LocatePromisePayload {
  chapterId: string;
  paragraphIndex: number;
  quote: string;
  blockId?: string;
}

export interface ChekhovGunTrackerProps {
  projectId?: string;
  project?: string;
}

export interface ChekhovGunTrackerEmits {
  (e: 'select-item', item: TrackedItem): void;
  (e: 'jump-to-chapter', chapterId: string): void;
  (e: 'locate-promise', payload: LocatePromisePayload): void;
}

export interface GunStatusColumnProps {
  title: string;
  icon: string;
  stateKey: 'active' | 'sleeping' | 'forgotten' | 'destroyed';
  items: TrackedItem[];
  colorClass: string;
  scope?: GunTrackerScope;
}

export interface GunStatusColumnEmits {
  (e: 'view-journey', item: TrackedItem): void;
}

export interface GunItemCardProps {
  item: TrackedItem;
}

export interface GunItemCardEmits {
  (e: 'view-journey', item: TrackedItem): void;
}

export interface GunJourneyModalProps {
  journey: ItemJourneyReport | null;
  isOpen: boolean;
  isLoading: boolean;
  activeItem?: TrackedItem | null;
}

export interface GunJourneyModalEmits {
  (e: 'close'): void;
  (e: 'jump-to-chapter', chapterId: string): void;
  (e: 'locate-node', payload: LocatePromisePayload): void;
}
