import type { Ref } from 'vue';
import type { SceneArcItem } from '@/types/generated/SceneArcItem';
import type { RichPlotPromise, PromiseMilestone } from '@/types/narrative';

export type { SceneArcItem, RichPlotPromise, PromiseMilestone };

export type PromiseActionsEmit = {
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
  (e: 'change'): void;
};

export interface UsePromiseActionsParams {
  props?: {
    project?: string;
    chapterId?: string | null;
  };
  project?: string;
  chapterId?: string | null;
  currentVolumeId?: string | null;
  promises: Ref<RichPlotPromise[]>;
  emit: PromiseActionsEmit;
  syncLocalBackup?: () => void;
}
