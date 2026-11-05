import type { StoryArc } from '@/stores/story_arcs.store';
import type { RichPlotPromise } from '@/features/chapters/components/panels/PromisesPanel/composables/PromiseActions.model';
import type { ArcStatus } from '../StoryArcs.model';

export interface ArcCardProps {
  arc: StoryArc;
  effectiveStatus: ArcStatus;
  linkedBlocks: RichPlotPromise[];
}

export type ArcCardEmits = {
  'update-status': [arc: StoryArc, status: ArcStatus];
  delete: [id?: string | null];
  locate: [payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }];
};

export interface PhaseCounts {
  setup: number;
  escalation: number;
  climax: number;
  resolution: number;
}
