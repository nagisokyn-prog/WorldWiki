import type { ChapterWithHierarchy, HierarchyVolume } from '@/stores/chapter.store'
import type { StoryArc } from '@/stores/story_arcs.store'
import type { PlanScopeType } from '../ChapterRightSidebar.model'

export interface PlanningMatrixTabProps {
  project: string;
    activePlanScope: PlanScopeType;
    selectedArcId: string | null;
    arcsList: StoryArc[];
    currentArcTitle: string;
    currentVolume?: HierarchyVolume | null;
    currentChapter?: ChapterWithHierarchy | null;
    currentChapterId?: string | null;
}

export type PlanningMatrixTabEmits = {
  (e: 'update:plan-scope', val: PlanScopeType): void;
    (e: 'select-arc', val: string | null): void;
};
