import type { InspectorChapter } from '../TimelineInspector.model';

export interface TimelineChapterNodeProps {
  chapter: InspectorChapter;
  index: number;
  isActive: boolean;
}

export type TimelineChapterNodeEmits = {
  (e: 'select', chapter: InspectorChapter): void;
  (e: 'navigate', chapter: InspectorChapter): void;
  (e: 'jump-flashback', chapter: InspectorChapter, event: MouseEvent): void;
  (e: 'set-hover', chapterId: string | null): void;
};
