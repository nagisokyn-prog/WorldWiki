import type { GunTrackerFilterState, GunTrackerScope } from '../../ChekhovGunTracker.model';

export interface ChekhovTrackerToolbarProps {
  filter: GunTrackerFilterState;
  gunsCount: number;
  itemsCount: number;
  totalCount: number;
  itemTypes: string[];
  volumeOptions?: Array<{ id: string; title: string }>;
}

export type ChekhovTrackerToolbarEmits = {
  (e: 'set-scope', scope: GunTrackerScope): void;
  (e: 'reset-filter'): void;
};
