import type { ChapterRevision } from '../composables/useChapterHistory'

export interface ChaptersHistoryDrawerProps {
  isOpen: boolean;
    isLoading: boolean;
    revisions: ChapterRevision[];
    previewingRevId: string | null;
    maxSaves: number;
    getDiffSummary: (curr: ChapterRevision, prev?: ChapterRevision) => string;
}

export type ChaptersHistoryDrawerEmits = {
  (e: 'close'): void;
    (e: 'update:maxSaves', val: number): void;
    (e: 'preview', rev: ChapterRevision): void;
    (e: 'togglePin', rev: ChapterRevision): void;
};
