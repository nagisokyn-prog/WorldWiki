import type { ActiveTreeNode, ChapterTreeNode } from './useChaptersMain'

export interface ChaptersMainProps {
  project: string;
    controlledChapterId?: string | null;
    activeTreeNode?: ActiveTreeNode | null;
}

export type ChaptersMainEmits = {
  'open-chapter-as-tab': [chapter: ChapterTreeNode];
    'chapter-unsaved': [];
    'chapter-saved': [];
    'chapter-renamed': [payload: { id: string; title: string }];
    'scroll-change': [scroll: number];
};
