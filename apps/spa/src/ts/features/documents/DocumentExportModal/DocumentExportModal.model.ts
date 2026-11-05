import type { SemanticDocument } from '@/services/document/ast/types';

export interface DocumentExportModalProps {
  document: SemanticDocument;
  projectName?: string;
  isOpen: boolean;
}

export interface DocumentExportModalEmits {
  (e: 'close'): void;
}
