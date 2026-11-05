import type { SemanticDocument } from '@/services/document/ast/types';

export interface DocumentProcessorProps {
  initialDocument?: SemanticDocument;
  projectName?: string;
}
