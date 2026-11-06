import type { Editor } from '@tiptap/vue-3'
export type PageSize = 'A4' | 'A5' | 'A3' | 'Letter';
export interface WordDocumentDTO {
  version?: number;
  sections?: unknown[];
}
import type { SemanticDocument } from '@/services/document/ast/types'
import type { DocumentBlock } from '../../composables/useTiptapSplitView'

export interface EditorBodyProps {
  editor?: Editor | null;
    editorMode: 'wysiwyg' | 'markdown' | 'split' | 'word';
    markdownContent: string;
    changedFields: string[];
    leftPanelWidth: number;
    rightPanelWidth: number;
    showStructure: boolean;
    selectedBlockIdx: number;
    documentStructure: DocumentBlock[];
    currentSemanticDocument: SemanticDocument;
    content: string;
    title: string;
    isCurrentPageLandscape: boolean;
    currentPageSize: PageSize;
}

export type EditorBodyEmits = {
  (e: 'update:markdownContent', val: string): void;
    (e: 'textarea-mounted', el: HTMLTextAreaElement | null): void;
    (e: 'scroll', ev: Event): void;
    (e: 'markdown-input', ev: Event): void;
    (e: 'markdown-keydown', ev: KeyboardEvent): void;
    (e: 'contextmenu', ev: MouseEvent): void;
    (e: 'start-resize-left', ev: MouseEvent): void;
    (e: 'start-resize-right', ev: MouseEvent): void;
    (e: 'scroll-to-block', idx: number): void;
    (e: 'cycle-tag', idx: number): void;
    (e: 'open-entity-selector'): void;
    (e: 'word-content-update', val: string): void;
    (e: 'word-document-update', doc: WordDocumentDTO): void;
    (e: 'word-change'): void;
};
