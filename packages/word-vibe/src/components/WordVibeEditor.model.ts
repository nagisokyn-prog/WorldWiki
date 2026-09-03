import type { PageSize, Orientation, MarginsMm, WordDocumentDTO } from '../types/dto';

export interface WordVibeEditorProps {
  content?: string;
  document?: WordDocumentDTO;
  pageSize?: PageSize;
  orientation?: Orientation;
  margins?: MarginsMm;
  chapterTitle?: string;
  isReadOnly?: boolean;
}

export type WordVibeEditorEmits = {
  (e: 'update:content', html: string): void;
  (e: 'update:document', doc: WordDocumentDTO): void;
  (e: 'change', payload?: { html: string; document?: WordDocumentDTO }): void;
  (e: 'open-entity', payload: { type: string; id: string }): void;
};
