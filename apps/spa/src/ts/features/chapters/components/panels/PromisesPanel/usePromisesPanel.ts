import { ref, watch, onMounted, onUnmounted } from 'vue';
import { plotApi } from '@/services/api/plot.api';
import {
  usePromiseFiltering,
  cleanId,
  PROMISE_KINDS,
  PROMISE_STATUSES,
  type ChapterMetaItem
} from './composables/usePromiseFiltering';
import { usePromiseActions } from './composables/usePromiseActions';
import type { PromiseMilestone, RichPlotPromise } from './composables/PromiseActions.model';
import { usePromiseResize } from './composables/usePromiseResize';
import { createPromiseQuoteSync } from './composables/usePromiseQuoteSync';
import type { PromisesPanelProps } from './PromisesPanel.model';

export type { ChapterMetaItem, PromiseMilestone, RichPlotPromise };
export { PROMISE_KINDS, PROMISE_STATUSES, cleanId };
export type { PromisesPanelProps };

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
    chapterId: () => props.chapterId,
    chapterTitle: () => props.chapterTitle,
    allChapters: () => props.allChapters
  });

  const actions = usePromiseActions({
    props,
    project: props.project,
    chapterId: props.chapterId ?? null,
    currentVolumeId: props.currentVolumeId,
    promises,
    emit
  });

  const { syncQuotesWithManuscript, cleanup: cleanupQuoteSync } = createPromiseQuoteSync({
    props,
    promises,
    onUpdatePromise: (item) => actions.updatePromise(item)
  });

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    const localKey = `ww_plot_promises_${props.project}`;
    try {
      const rawList = await plotApi.getPlotPromises(props.project);
      const list = Array.isArray(rawList) ? (rawList as unknown as RichPlotPromise[]) : [];
      promises.value = list.map((p) => {
        const milestones = Array.isArray(p.milestones) ? p.milestones : [];
        const plant = milestones.find((m) => m.stage === 'plant') || milestones[0];
        const progressions = milestones.filter((m) => m.stage === 'progression');
        const resolution = milestones.find((m) => m.stage === 'resolution') || null;

        const cleanParent = p.parent_id && p.parent_id !== 'NONE' && p.parent_id !== 'plot_promises:NONE'
          ? p.parent_id
          : null;
        const cleanBlockIds = Array.isArray(p.block_ids)
          ? p.block_ids
              .filter((b): b is string => typeof b === 'string' && b.trim().length > 0 && b !== 'NONE')
              .map((b) => {
                const stripped = b.replace(/^(text_blocks|blocks):/i, '').replace(/[`⟨⟩"']/g, '').trim();
                const pm = stripped.match(/(para-\d+)$/i);
                return pm ? pm[1] : stripped.replace(/^blk_[^_]+_/, '');
              })
          : [];

        return {
          ...p,
          parent_id: cleanParent,
          block_ids: cleanBlockIds,
          chapter_id: p.chapter_id || plant?.chapter_id || '',
          quote: p.quote || plant?.quote || p.title || '',
          paragraph_index: p.paragraph_index || plant?.order_index || 1,
          block_id: p.block_id || plant?.block_id || cleanBlockIds[0] || null,
          progressions: p.progressions || progressions,
          resolution: p.resolution || resolution,
          milestones
        };
      });
      try {
        if (promises.value.length === 0) {
          localStorage.removeItem(localKey);
        } else {
          localStorage.setItem(localKey, JSON.stringify(promises.value));
        }
      } catch (err) {
        console.warn('[usePromisesPanel] Failed to sync promises cache with localStorage:', err);
      }
      syncQuotesWithManuscript();
    } catch (err) {
      console.warn('[usePromisesPanel] Failed to load promises from backend:', err);
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          promises.value = JSON.parse(stored);
          syncQuotesWithManuscript();
        }
      } catch (e) {
        console.warn('[usePromisesPanel] Failed to restore promises from local fallback:', e);
      }
    } finally {
      loading.value = false;
    }
  };

  watch(() => [props.project, props.chapterId], loadPromises);

  // Триггерится каждый раз, когда Tiptap-редактор генерирует новый HTML.
  // Т.к. content теперь явно объявлен в интерфейсе — Vue правильно отслеживает изменения.
  watch(
    () => props.chapterData?.content,
    (newVal, oldVal) => {
      syncQuotesWithManuscript(Boolean(oldVal && newVal !== oldVal));
    },
    { immediate: true }
  );

  const onEditorUpdate = () => { syncQuotesWithManuscript(true); };
  onMounted(() => {
    loadPromises();
    document.addEventListener('ww:editor-content-updated', onEditorUpdate);
  });
  onUnmounted(() => {
    cleanupQuoteSync();
    document.removeEventListener('ww:editor-content-updated', onEditorUpdate);
  });

  return {
    syncQuotesWithManuscript,
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
    addSubScene: actions.addSubScene,
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
