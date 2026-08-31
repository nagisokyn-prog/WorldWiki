import type { Editor } from '@tiptap/vue-3';

export type DocumentViewMode = 'page' | 'canvas';

export interface DocumentLayoutBarProps {
  editor: Editor | null;
  initialMode?: DocumentViewMode;
  initialRulerVisible?: boolean;
}
