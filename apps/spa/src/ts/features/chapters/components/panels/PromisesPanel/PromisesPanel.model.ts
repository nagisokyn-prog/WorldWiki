import type { ChapterMetaItem } from './composables/usePromiseFiltering';

export interface PromisesPanelProps {
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  allChapters?: ChapterMetaItem[];
  chapterData?: {
    id?: string | null;
    title?: string | null;
    content?: string | null;
    participants?: unknown;
    timeline_events?: unknown;
    [key: string]: unknown;
  } | null;
}

export type PromisesPanelEmits = {
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
  (e: 'open-journey'): void;
};
