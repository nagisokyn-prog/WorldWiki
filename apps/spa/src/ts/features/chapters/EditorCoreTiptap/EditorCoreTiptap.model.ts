import type { PlotPromise } from '@/types/generated/PlotPromise';

export interface EditorCoreTiptapProps {
  project: string;
  title?: string;
  content?: string;
  hasUnsavedChanges?: boolean;
  footnotesData?: Record<string, { id: string; text: string }>;
  initialScrollPos?: number;
  changedFields?: string[];
  existingPromises?: PlotPromise[];
}

export interface EditorCoreTiptapEmits {
  (e: 'update:title', title: string): void;
  (e: 'update:content', content: string): void;
  (e: 'update:footnotesData', data: Record<string, { id: string; text: string }>): void;
  (e: 'change'): void;
  (e: 'save'): void;
  (e: 'openEntity', entity: { type: string; id: string; name?: string }): void;
  (e: 'open-entity', entity: { type: string; id: string; name?: string }): void;
  (e: 'scroll-change', pos: number): void;
  (e: 'toggle-history'): void;
  (e: 'open-entity-selector'): void;
  (e: 'add-participant', payload: { type: string; id: string; name?: string }): void;
  (e: 'create-promise', payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }): void;
  (e: 'link-milestone', payload: { promiseId: string; stage: 'progression' | 'resolution'; quote: string; paragraph_index: number; block_id?: string | null }): void;
}
