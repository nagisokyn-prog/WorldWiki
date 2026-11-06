export interface ChapterArcTagsProps {
  project: string;
  chapterId?: string | null;
}

export interface ChapterArcTagsEmits {
  (e: 'change'): void;
}

export interface ChapterBoundArc {
  arcId: string;
  title: string;
  color?: string | null;
  arcType: string;
}
