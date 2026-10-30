import type { MatrixEntity } from '@/stores/analytics.store';

export type AppearanceStatus = 'scene' | 'mention' | 'deceased' | 'absent';

export interface CellStatusInfo {
  status: AppearanceStatus;
  role?: string | null;
  label: string;
}

export interface EntityPresenceRow {
  entity: MatrixEntity;
  cells: Map<string, CellStatusInfo>;
  totalAppearances: number;
  hasGapWarning: boolean;
}

export interface CrossReferenceFilterState {
  searchQuery: string;
  selectedEntityType: string;
  selectedVolumeId: string;
  showDeceasedOnly: boolean;
  highlightGaps: boolean;
}

export interface CrossReferenceMatrixProps {
  project?: string;
}

export type CrossReferenceMatrixEmits = {};
