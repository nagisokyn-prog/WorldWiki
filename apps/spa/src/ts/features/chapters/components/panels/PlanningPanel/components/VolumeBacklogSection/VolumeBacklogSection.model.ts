import type { TapestryTodo } from '../../PlanningPanel.model';

export interface BacklogChapterOption {
  chapterId: string;
  title: string;
}

export interface VolumeBacklogSectionProps {
  items: TapestryTodo[];
  volumeId?: string | null;
  currentChapterId?: string | null;
  chapters?: BacklogChapterOption[];
}

export type VolumeBacklogSectionEmits = {
  (e: 'move-to-chapter', payload: { todoId: string; targetChapterId: string }): void;
  (e: 'delete', item: TapestryTodo): void;
  (e: 'add-backlog', payload: { ownerId: string; text: string }): void;
};

