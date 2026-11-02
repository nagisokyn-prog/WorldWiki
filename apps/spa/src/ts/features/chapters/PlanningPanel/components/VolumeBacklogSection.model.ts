import type { TapestryTodo } from '../PlanningPanel.model';

export interface VolumeBacklogSectionProps {
  items: TapestryTodo[];
  volumeId?: string | null;
  currentChapterId?: string | null;
}

export type VolumeBacklogSectionEmits = {
  (e: 'move-to-chapter', todoId: string): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'add-backlog', payload: { ownerId: string; text: string }): void;
};

