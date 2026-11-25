import type { PromiseMilestone, RichPlotPromise } from '../../../../usePromisesPanel';
import type { SharedPromiseEntities } from '../../../PromiseCardMeta/PromiseCardMeta.model';

export interface PromiseMilestoneCardProps {
  project: string;
  parentItem: RichPlotPromise;
  milestone: PromiseMilestone;
  stage: 'progression' | 'resolution';
  getChapterTitle: (chapterId: string) => string;
  isCurrentChapterPromise: (chapterId: string) => boolean;
  previousScene?: RichPlotPromise | null;
  sharedEntities?: SharedPromiseEntities | null;
}

export type PromiseMilestoneCardEmits = {
  (e: 'locateStep', payload: { chapter_id: string; paragraph_index: number; quote: string }): void;
  (e: 'removeMilestone', payload: { item: RichPlotPromise; milestoneId: string; stage: 'progression' | 'resolution' }): void;
  (e: 'update:item', item: RichPlotPromise): void;
  (e: 'change'): void;
};
