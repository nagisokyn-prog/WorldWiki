import type { TapestryArcGroup, TapestryTodo, DependencyCandidate, TodoStatus } from '../../PlanningPanel.model';

export interface PlanArcGroupProps {
  arcGroup: TapestryArcGroup;
  chapterId: string;
  allTodos?: DependencyCandidate[];
}

export type PlanArcGroupEmits = {
  (e: 'toggle', item: TapestryTodo): void;
  (e: 'cycle-status', item: TapestryTodo, status?: TodoStatus): void;
  (e: 'set-status', item: TapestryTodo, status: TodoStatus): void;
  (e: 'save', item: TapestryTodo): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'navigate', chapterId: string): void;
  (e: 'add-todo', payload: { ownerId: string; text: string; arcId?: string | null }): void;
  (e: 'set-dependency', item: TapestryTodo, parentId: string | null): void;
};

