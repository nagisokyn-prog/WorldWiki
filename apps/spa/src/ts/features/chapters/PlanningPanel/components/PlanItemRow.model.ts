import type { TapestryTodo } from '../PlanningPanel.model';

export interface PlanItemRowProps {
  item: TapestryTodo;
}

export type PlanItemRowEmits = {
  (e: 'toggle', item: TapestryTodo): void;
  (e: 'cycle-status', item: TapestryTodo): void;
  (e: 'save', item: TapestryTodo): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'navigate', chapterId: string): void;
};
