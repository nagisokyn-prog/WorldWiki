import type { TapestryChapterNode, TapestryTodo, DependencyCandidate, TodoStatus } from '../PlanningPanel.model';
import type { StoryArc } from '@/stores/story_arcs.store';

export interface TapestryChapterCardProps {
  chapter: TapestryChapterNode;
  allProjectArcs: StoryArc[];
  allTodos?: DependencyCandidate[];
}

export type TapestryChapterCardEmits = {
  (e: 'toggle', item: TapestryTodo): void;
  (e: 'cycle-status', item: TapestryTodo, status?: TodoStatus): void;
  (e: 'set-status', item: TapestryTodo, status: TodoStatus): void;
  (e: 'save', item: TapestryTodo): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'navigate', chapterId: string): void;
  (e: 'toggle-collapse', chapterId: string): void;
  (e: 'add-todo', payload: { ownerId: string; text: string; arcId?: string | null }): void;
  (e: 'attach-arc', payload: { chapterId: string; arcId: string }): void;
  (e: 'set-dependency', item: TapestryTodo, parentId: string | null): void;
};

