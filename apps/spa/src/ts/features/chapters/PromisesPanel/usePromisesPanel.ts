import { ref, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import {
  usePromiseFiltering,
  cleanId,
  PROMISE_KINDS,
  PROMISE_STATUSES,
  type ChapterMetaItem
} from './composables/usePromiseFiltering';
import {
  usePromiseActions,
  type PromiseMilestone,
  type RichPlotPromise
} from './composables/usePromiseActions';
import { usePromiseResize } from './composables/usePromiseResize';

export type { ChapterMetaItem, PromiseMilestone, RichPlotPromise };
export { PROMISE_KINDS, PROMISE_STATUSES, cleanId };

export interface PromisesPanelProps {
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  allChapters?: ChapterMetaItem[];
}

export function usePromisesPanel(
  props: PromisesPanelProps,
  emit: {
    (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
  }
) {
  const promises = ref<RichPlotPromise[]>([]);
  const loading = ref(false);
  const isCollapsed = ref(false);

  const resize = usePromiseResize();

  const filtering = usePromiseFiltering<RichPlotPromise>({
    promises,
    chapterId: props.chapterId,
    chapterTitle: props.chapterTitle,
    allChapters: props.allChapters
  });

  const actions = usePromiseActions({
    props,
    project: props.project,
    chapterId: props.chapterId,
    currentVolumeId: props.currentVolumeId,
    promises,
    emit
  });

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    try {
      const list = await api.getPlotPromises(props.project);
      promises.value = Array.isArray(list) ? (list as unknown as RichPlotPromise[]) : [];
    } catch {
      const localKey = `ww_plot_promises_${props.project}`;
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          promises.value = JSON.parse(stored);
        }
      } catch { /* ignore */ }
    } finally {
      loading.value = false;
    }
  };

  watch(() => props.project, loadPromises);
  onMounted(loadPromises);

  return {
    isCollapsed,
    promises,
    chapterPromises: filtering.chapterPromises,
    filteredPromises: filtering.filteredPromises,
    loading,
    editingNoteId: actions.editingNoteId,
    noteDraft: actions.noteDraft,
    scopeFilter: filtering.scopeFilter,
    statusFilter: filtering.statusFilter,
    categoryFilter: filtering.categoryFilter,
    loadPromises,
    addPromise: actions.addPromise,
    addNewScene: actions.addNewScene,
    updatePromise: actions.updatePromise,
    addMilestone: actions.addMilestone,
    removeMilestone: actions.removeMilestone,
    updateStatus: actions.updateStatus,
    startEditNote: actions.startEditNote,
    saveNote: actions.saveNote,
    cancelEditNote: actions.cancelEditNote,
    removePromise: actions.removePromise,
    locateSource: actions.locateSource,
    getKindInfo: filtering.getKindInfo,
    getChapterTitle: filtering.getChapterTitle,
    isCurrentChapterPromise: filtering.isCurrentChapterPromise,
    promptAttachMilestone: actions.promptAttachMilestone,
    promisesHeight: resize.promisesHeight,
    isResizing: resize.isResizing,
    startVerticalResize: resize.startVerticalResize
  };
}
