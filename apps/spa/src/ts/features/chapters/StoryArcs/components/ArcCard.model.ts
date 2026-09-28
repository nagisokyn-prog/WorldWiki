import type { StoryArc } from '@/stores/story_arcs.store';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { ArcStatus } from '../StoryArcs.model';

export interface ArcCardProps {
  arc: StoryArc;
  effectiveStatus: ArcStatus;
  linkedBlocks: PlotPromise[];
}

export interface ArcCardEmits {
  (e: 'update-status', arc: StoryArc, status: ArcStatus): void;
  (e: 'delete', id?: string | null): void;
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
}

export interface PhaseCounts {
  setup: number;
  escalation: number;
  climax: number;
  resolution: number;
}
