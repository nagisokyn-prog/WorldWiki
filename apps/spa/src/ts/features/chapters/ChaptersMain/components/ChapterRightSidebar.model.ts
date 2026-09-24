import type { ActiveTreeNode } from '../useChaptersMain';
import type { ChapterWithHierarchy, HierarchyVolume } from '@/stores/chapter.store';
import type { TimelineEvent } from '../../../timeline/Calendars/TimelinePanel/useTimelinePanel';
import type { ParticipantItem } from '../../ParticipantsPanel/useParticipantsPanel';

export type SidebarTabType = 'promises' | 'plans';
export type PlanScopeType = 'volume' | 'arc' | 'chapter';
export type PanelResizeType = 'timeline' | 'participants' | 'volumePlan' | 'chapterPlan' | 'general';

export interface ChapterRightSidebarProps {
  project: string;
  isVisible: boolean;
  width: number;
  activeTreeNode?: ActiveTreeNode | null;
  currentChapter?: ChapterWithHierarchy | null;
  currentVolume?: HierarchyVolume | null;
  currentChapterId?: string | null;
  chapters: ChapterWithHierarchy[];
  isTimelineOpen?: boolean;
  isParticipantsOpen?: boolean;
  isVolumePlanOpen?: boolean;
  isChapterPlanOpen?: boolean;
}

export interface ChapterRightSidebarEmits {
  (e: 'toggleTimeline'): void;
  (e: 'toggleParticipants'): void;
  (e: 'toggleVolumePlan'): void;
  (e: 'toggleChapterPlan'): void;
  (e: 'addVolumePlanItem'): void;
  (e: 'addChapterPlanItem'): void;
  (e: 'markUnsaved'): void;
  (e: 'update:timeline-events', val: TimelineEvent[]): void;
  (e: 'update:participants', val: ParticipantItem[]): void;
  (e: 'locatePromise', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
}

