import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { Ref } from 'vue';

export interface PromiseMilestone {
  id: string;
  chapter_id: string;
  paragraph_index: number;
  quote: string;
  note?: string | null;
  created_at?: string | null;
}

export interface SceneArcItem {
  arc_id: string;
  arc_phase?: string | null;
}

export type RichPlotPromise = Omit<PlotPromise, 'progressions' | 'resolution' | 'arcs' | 'm_abs' | 'calendar_id' | 'date_fields'> & {
  progressions?: PromiseMilestone[] | null;
  resolution?: PromiseMilestone | null;
  arcs?: SceneArcItem[] | null;
  m_abs?: number | null;
  calendar_id?: string | null;
  date_fields?: {
    era_index?: number;
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
  } | null;
  /** UI-флаг: текст был удалён из рукописи (не сохраняется в БД) */
  is_orphaned?: boolean;
};

export interface UsePromiseActionsParams {
  project?: string;
  chapterId?: string | null;
  currentVolumeId?: string | null;
  props?: { project?: string; chapterId?: string | null; currentVolumeId?: string | null };
  promises: Ref<RichPlotPromise[]>;
  emit: {
    (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
  };
}
