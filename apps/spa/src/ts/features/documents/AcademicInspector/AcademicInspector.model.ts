import type { Editor } from '@tiptap/core';
import type { SemanticDocument } from '../../../services/document/ast/types';
import type { NumberingContext } from '../../../services/document/numbering/types';

export type InspectorTab = 'toc' | 'figures' | 'tables' | 'equations' | 'profiles';

export interface AcademicInspectorProps {
  editor: Editor | null;
  document: SemanticDocument;
  numberingContext: NumberingContext;
}

export interface InspectorItem {
  id: string;
  kind: 'heading' | 'figure' | 'table' | 'equation';
  number: string;
  title: string;
  level?: number;
}
