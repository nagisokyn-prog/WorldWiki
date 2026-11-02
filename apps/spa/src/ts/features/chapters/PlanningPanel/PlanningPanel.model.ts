import type { TodoStatus } from '@/types/generated/Todo';

export type { TodoStatus };

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
  status?: TodoStatus;
  sort_order?: number;
  indent: number;
  arc_id?: string | null;
  arc_title?: string | null;
  depends_on?: string | null;
  depends_on_title?: string | null;
}

export interface StoryArcSummary {
  id: string;
  title: string;
  status?: string;
}

export interface PlanningPanelProps {
  project?: string;
  parentType?: string;
  parentId?: string;
  parentTitle?: string;
  arcsList?: StoryArcSummary[];
  selectedArcFilter?: string | null;
}

export type PlanningPanelEmits = {
  change: [];
  'select-arc': [arcId: string | null];
};
