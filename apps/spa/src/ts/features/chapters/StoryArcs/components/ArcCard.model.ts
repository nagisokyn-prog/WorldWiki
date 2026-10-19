import type { StoryArc } from '@/stores/story_arcs.store';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { ArcStatus } from '../StoryArcs.model';

export interface ArcCardProps {
  arc: StoryArc;
  effectiveStatus: ArcStatus;
  linkedBlocks: PlotPromise[];
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
