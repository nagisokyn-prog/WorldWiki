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

export type RkWordEditorEmits =
  & ((e: 'update:content', content: string) => void)
  & ((e: 'open-header-footer-dialog', tab?: 'header' | 'footer') => void)
  & ((e:
      | 'change'
      | 'save'
      | 'open-image-dialog'
      | 'open-table-picker'
      | 'open-link-dialog'
      | 'open-equation-dialog'
      | 'open-page-setup'
      | 'open-font-dialog'
      | 'open-paragraph-dialog'
    ) => void);

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
