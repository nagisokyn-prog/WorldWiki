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

export type PromiseCardEmits = {
  remove: [item: RichPlotPromise];
  locate: [payload: { chapter_id: string; paragraph_index: number; quote: string; block_id?: string | null }];
  removeMilestone: [payload: { item: RichPlotPromise; milestoneId: string; stage: 'progression' | 'resolution' }];
  promptAttachMilestone: [payload: { item: RichPlotPromise; stage: 'progression' | 'resolution' }];
  startEditNote: [item: RichPlotPromise];
  cancelEditNote: [];
  saveNote: [item: RichPlotPromise];
  'update:noteDraft': [val: string];
  'update:item': [val: RichPlotPromise];
  change: [];
};

export type PromiseCardEmitFn = {
  <K extends keyof PromiseCardEmits>(e: K, ...args: PromiseCardEmits[K]): void;
};
