import type { StoryArc } from '@/stores/story_arcs.store';

import type { SceneArcItem } from '@/types/generated/SceneArcItem';

export type ArcPhase = 'setup' | 'escalation' | 'climax' | 'resolution';
export type { SceneArcItem };

export interface BoundArcWithMeta {
  arcId: string;
  title: string;
  color?: string | null;
  arcType?: string | null;
  phase: ArcPhase | string;
}

export interface PromiseCardArcTagsProps {
  project?: string;
  arcs?: SceneArcItem[] | null;
  availableArcs?: StoryArc[];
  legacyArcId?: string | null;
  legacyArcPhase?: string | null;
}

export interface PromiseCardArcTagsEmits {
  (e: 'update:arcs', arcs: SceneArcItem[]): void;
  (e: 'change'): void;
}
