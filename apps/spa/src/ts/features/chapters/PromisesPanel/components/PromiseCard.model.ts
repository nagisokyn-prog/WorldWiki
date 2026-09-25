import type { RichPlotPromise } from '../usePromisesPanel';

export interface PromiseCardProps {
  project: string;
  item: RichPlotPromise;
  kindInfo: { label: string; icon: string };
  editingNoteId: string | null;
  noteDraft: string;
  getChapterTitle: (chapterId: string) => string;
  isCurrentChapterPromise: (chapterId: string) => boolean;
}

export interface PromiseCardEmits {
  (e: 'remove', item: RichPlotPromise): void;
  (e: 'locate', payload: { chapter_id: string; paragraph_index: number; quote: string; block_id?: string | null }): void;
  (e: 'removeMilestone', payload: { item: RichPlotPromise; milestoneId: string; stage: 'progression' | 'resolution' }): void;
  (e: 'promptAttachMilestone', payload: { item: RichPlotPromise; stage: 'progression' | 'resolution' }): void;
  (e: 'startEditNote', item: RichPlotPromise): void;
  (e: 'cancelEditNote'): void;
  (e: 'saveNote', item: RichPlotPromise): void;
  (e: 'update:noteDraft', val: string): void;
  (e: 'update:item', val: RichPlotPromise): void;
  (e: 'change'): void;
}
