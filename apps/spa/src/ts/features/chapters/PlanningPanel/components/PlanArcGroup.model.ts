import type { TapestryArcGroup, TapestryTodo } from '../PlanningPanel.model';

export interface PlanArcGroupProps {
  arcGroup: TapestryArcGroup;
  chapterId: string;
}

export type PlanArcGroupEmits = {
  (e: 'toggle', item: TapestryTodo): void;
  (e: 'cycle-status', item: TapestryTodo): void;
  (e: 'save', item: TapestryTodo): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'navigate', chapterId: string): void;
  (e: 'add-todo', payload: { ownerId: string; text: string; arcId?: string | null }): void;
};
