import type { MatrixEntity } from '@/stores/analytics.store';

export type AppearanceStatus = 'scene' | 'mention' | 'both' | 'deceased' | 'absent';

export interface CellStatusInfo {
  status: AppearanceStatus;
  hasScene: boolean;
  hasMention: boolean;
  isDeceased: boolean;
  count: number;
  role?: string | null;
  label: string;
}

export interface EntityPresenceRow {
  entity: MatrixEntity;
  cells: Map<string, CellStatusInfo>;
  cellList: Array<CellStatusInfo & { chapterId: string; chapterTitle: string }>;
  totalAppearances: number;
  totalScenes: number;
  totalMentions: number;
  hasGapWarning: boolean;
}

export interface CrossReferenceFilterState {
  searchQuery: string;
  selectedEntityType: string;
  selectedVolumeId: string;
  showDeceasedOnly: boolean;
  highlightGaps: boolean;
}

export interface ChapterColumnSummary {
  id: string;
  sort_order: number;
  title: string;
  word_count: number;
  formattedWordCount: string;
  uniqueEntities: number;
}

export interface CrossReferenceMatrixProps {
  project?: string;
}

export type CrossReferenceMatrixEmits = {};
