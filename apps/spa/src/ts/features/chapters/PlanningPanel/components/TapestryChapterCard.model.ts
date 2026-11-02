import type { TapestryChapterNode, TapestryTodo } from '../PlanningPanel.model';
import type { StoryArc } from '@/stores/story_arcs.store';

export interface TapestryChapterCardProps {
  chapter: TapestryChapterNode;
  allProjectArcs: StoryArc[];
}

export type TapestryChapterCardEmits = {
  (e: 'toggle', item: TapestryTodo): void;
  (e: 'cycle-status', item: TapestryTodo): void;
  (e: 'save', item: TapestryTodo): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'navigate', chapterId: string): void;
  (e: 'toggle-collapse', chapterId: string): void;
  (e: 'add-todo', payload: { ownerId: string; text: string; arcId?: string | null }): void;
  (e: 'attach-arc', payload: { chapterId: string; arcId: string }): void;
};
