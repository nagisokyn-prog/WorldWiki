import type { MatrixEntity } from '@/stores/analytics.store';

export type { MatrixChapter, MatrixEntity, MatrixAppearance } from '@/stores/analytics.store';

export type AppearanceStatus = 'scene' | 'mention' | 'absent' | 'deceased';

export interface CellStatusInfo {
  status: AppearanceStatus;
  role?: string | null;
  label: string;
}

export interface CrossReferenceFilterState {
  searchQuery: string;
  selectedEntityType: string;
  selectedVolumeId: string;
  showDeceasedOnly: boolean;
  highlightGaps: boolean;
}

export interface EntityPresenceRow {
  entity: MatrixEntity;
  cells: Map<string, CellStatusInfo>; // chapter_id -> CellStatusInfo
  totalAppearances: number;
  hasGapWarning: boolean; // Gap >= 3 chapters
}
