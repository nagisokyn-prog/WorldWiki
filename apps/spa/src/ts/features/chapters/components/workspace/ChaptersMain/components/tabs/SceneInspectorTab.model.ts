import type { ChapterWithHierarchy } from '@/stores/chapter.store'
import type { PanelResizeType } from '../ChapterRightSidebar.model'
import type { TimelineEvent } from '@/features/timeline/components/inspectors/TimelinePanel/useTimelinePanel'
import type { ParticipantItem } from '@/features/chapters/components/panels/ParticipantsPanel/useParticipantsPanel'

export interface SceneInspectorTabProps {
  project: string;
    currentChapter?: ChapterWithHierarchy | null;
    isTimelineOpen?: boolean;
    isParticipantsOpen?: boolean;
    timelineHeight: number;
    participantsHeight: number;
    activeResizing?: PanelResizeType | null;
}

export type SceneInspectorTabEmits = {
  (e: 'toggle-timeline'): void;
    (e: 'toggle-participants'): void;
    (e: 'update:timeline-events', val: TimelineEvent[]): void;
    (e: 'update:participants', val: ParticipantItem[]): void;
    (e: 'mark-unsaved'): void;
    (e: 'start-resize', event: MouseEvent, panel: PanelResizeType): void;
};
