import type { Editor } from '@tiptap/vue-3';
import type { AppSettings } from '@worldwiki/components';

export interface EditorModeOption {
  value: string;
  label: string;
}

export interface EditorCommands {
  toggleBold?: () => boolean | undefined;
  toggleItalic?: () => boolean | undefined;
  toggleStrike?: () => boolean | undefined;
  setHeading?: (level: number) => boolean | undefined;
  toggleBlockquote?: () => boolean | undefined;
  toggleBulletList?: () => boolean | undefined;
  toggleOrderedList?: () => boolean | undefined;
  insertImage?: () => void;
  insertTable?: () => void;
  insertLink?: () => void;
  clearFormatting?: () => void;
  toggleLinkLock?: () => void;
  analyzeText?: () => void;
  [key: string]: unknown;
}

export interface EditorToolbarProps {
  project?: string;
  chapterId?: string | null;
  editor: Editor | null | undefined;
  editorMode: string;
  modeOptions: EditorModeOption[];
  hasUnsavedChanges: boolean;
  settings: AppSettings | null;
  commands: EditorCommands;
  title?: string;
  isLocked?: boolean;
  changedFields?: string[];
}
