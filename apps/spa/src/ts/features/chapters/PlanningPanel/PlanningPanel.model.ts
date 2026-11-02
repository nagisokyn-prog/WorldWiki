import type { StoryArc } from '@/stores/story_arcs.store';

export type TodoStatus = 'planned' | 'in_progress' | 'done' | 'blocked';

export interface TapestryTodo {
  id: string;
  text: string;
  status: TodoStatus;
  done: boolean;
  owner_id: string;
  sort_order: number;
  arc_id?: string | null;
  arc_title?: string | null;
  arc_color?: string | null;
  depends_on?: string | null;
  depends_on_title?: string | null;
  blocks_title?: string | null;
  blocks_chapter_id?: string | null;
}

export interface TapestryArcGroup {
  arcId: string;
  title: string;
  color?: string | null;
  phase?: string | null;
  phaseLabel?: string;
  todos: TapestryTodo[];
}

export interface TapestryChapterNode {
  chapterId: string;
  title: string;
  sortOrder: number;
  isCurrent: boolean;
  isCollapsed: boolean;
  arcGroups: TapestryArcGroup[];
  standaloneTodos: TapestryTodo[];
  doneCount: number;
  totalCount: number;
}

export interface StoryArcSummary {
  id: string | null;
  title: string;
  status?: string;
  color?: string | null;
}

export interface PlanningPanelProps {
  project?: string;
  volumeId?: string | null;
  volumeTitle?: string;
  currentChapterId?: string | null;
  currentChapterTitle?: string;
  arcsList?: StoryArc[];
  selectedArcFilter?: string | null;
}

export type PlanningPanelEmits = {
  change: [];
  'select-chapter': [chapterId: string];
  'select-arc': [arcId: string | null];
};
