import type { PageSize, Orientation, MarginsMm } from '../types/dto';

export interface WordVibeEditorProps {
  content?: string;
  pageSize?: PageSize;
  orientation?: Orientation;
  margins?: MarginsMm;
  chapterTitle?: string;
  isReadOnly?: boolean;
}

export type WordVibeEditorEmits = {
  (e: 'update:content', html: string): void;
  (e: 'change'): void;
  (e: 'open-entity', payload: { type: string; id: string }): void;
};
