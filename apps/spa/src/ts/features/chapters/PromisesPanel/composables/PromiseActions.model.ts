import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { Ref } from 'vue';

export interface PromiseMilestone {
  milestone_id: string | null;
  id?: string;
  stage: string;
  quote: string | null;
  note: string | null;
  block_id: string;
  chapter_id: string | null;
  paragraph_index?: number;
  order_index: number | null;
  created_at?: string | null;
}

import type { SceneArcItem } from '@/types/generated/SceneArcItem';
export type { SceneArcItem };

export type RichPlotPromise = PlotPromise & {
  chapter_id?: string;
  quote?: string;
  paragraph_index?: number;
  block_id?: string | null;
  progressions?: PromiseMilestone[] | null;
  resolution?: PromiseMilestone | null;
  resolved_in_volume?: string | null;
  resolved_in_chapter?: string | null;
  arcs?: SceneArcItem[] | null;
  location_id?: string | null;
  timeline_event_id?: string | null;
  arc_id?: string | null;
  arc_phase?: string | null;
  participant_ids?: string[] | null;
  m_abs?: number | null;
  calendar_id?: string | null;
  date_fields?: Record<string, unknown> | null;
  time_nature?: string | null;
  is_flashback?: boolean;
  /** UI-флаг: текст был удалён из рукописи (не сохраняется в БД) */
  is_orphaned?: boolean;
};

export type PromiseActionsEmit = {
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
};

export interface UsePromiseActionsParams {
  props?: {
    project?: string;
    chapterId?: string | null;
  };
  project?: string;
  chapterId?: string | null;
  currentVolumeId?: string | null;
  promises: Ref<RichPlotPromise[]>;
  emit: PromiseActionsEmit;
  syncLocalBackup?: () => void;
}
