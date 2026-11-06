import type { EntityRevision } from '../EntityEditor.model';

export type { EntityRevision };

export interface EntityHistoryAsideProps {
  maxSaves: number;
  isLoading: boolean;
  revisions: EntityRevision[];
  previewingRevId?: string | null;
  getDiffSummary: (curr: EntityRevision, prev?: EntityRevision) => string;
}

export type EntityHistoryAsideEmits = {
  (e: 'close'): void;
  (e: 'update:maxSaves', val: number): void;
  (e: 'preview', rev: EntityRevision): void;
  (e: 'togglePin', rev: EntityRevision): void;
};
