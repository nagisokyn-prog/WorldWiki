import type { ExportChapterItem, ExportPayload } from './useExportModal'

export interface ExportModalProps {
  isOpen: boolean;
    allChapters?: ExportChapterItem[];
    currentChapterId?: string | null;
}

export type ExportModalEmits = {
  (e: 'close'): void;
    (e: 'export', payload: ExportPayload): void;
};
