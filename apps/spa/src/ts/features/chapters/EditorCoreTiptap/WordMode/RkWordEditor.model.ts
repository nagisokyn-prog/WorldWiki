export type PageSize = 'A4' | 'A5' | 'A3' | 'Letter' | 'B5' | 'Legal' | 'Tabloid' | 'Custom';
export type Orientation = 'portrait' | 'landscape';

export interface RkWordEditorProps {
  content: string;
  editable?: boolean;
  isReadOnly?: boolean;
  chapterTitle?: string;
  initialOrientation?: Orientation;
  initialPageSize?: PageSize;
}

export interface RkWordEditorEmits {
  (e: 'update:content', content: string): void;
  (e: 'change'): void;
  (e: 'save'): void;
}

import type { WordEditor } from '@raazkhnl/rk-editor-core';

export interface RkWordEditorState {
  pageSize: PageSize;
  orientation: Orientation;
  pageCount: number;
  wordCount: number;
  characterCount: number;
  zoom: number;
}

export type EditorInstance = WordEditor['instance'];
