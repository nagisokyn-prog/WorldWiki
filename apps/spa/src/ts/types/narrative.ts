import type { PlotPromise } from './generated/PlotPromise';
import type { SceneArcItem } from './generated/SceneArcItem';

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

export type RichPlotPromise = PlotPromise & {
  parent_id?: string | null;
  children?: RichPlotPromise[];
  chapter_id?: string;
  quote?: string;
  paragraph_index?: number;
  block_id?: string | null;
  block_ids?: string[];
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
