import type { Editor } from '@tiptap/core';

export type DocumentViewMode = 'page' | 'canvas';

export interface DocumentLayoutBarProps {
  editor: Editor | null;
  initialMode?: DocumentViewMode;
  initialRulerVisible?: boolean;
}
