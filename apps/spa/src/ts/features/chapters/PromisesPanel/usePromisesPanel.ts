import { ref, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import {
  usePromiseFiltering,
  cleanId,
  PROMISE_KINDS,
  PROMISE_STATUSES,
  type ChapterMetaItem
} from './composables/usePromiseFiltering';

export type { ChapterMetaItem };
export { PROMISE_KINDS, PROMISE_STATUSES };

export interface PromiseMilestone {
  id: string;
  chapter_id: string;
  paragraph_index: number;
  quote: string;
  note?: string | null;
  created_at?: string | null;
}

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
  const promises = ref<PlotPromise[]>([]);
  const loading = ref(false);
  const editingNoteId = ref<string | null>(null);
  const noteDraft = ref('');
  const isCollapsed = ref(false);

  const filtering = usePromiseFiltering({
    promises,
    chapterId: props.chapterId,
    chapterTitle: props.chapterTitle,
    allChapters: props.allChapters
  });

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    try {
      const list = await api.getPlotPromises(props.project);
      promises.value = Array.isArray(list) ? list : [];
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

  const syncLocalBackup = () => {
    if (!props.project) return;
    try {
      localStorage.setItem(`ww_plot_promises_${props.project}`, JSON.stringify(promises.value));
    } catch { /* ignore */ }
  };

  const addPromise = async (payload: {
    kind: string;
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
  }) => {
    if (!props.project || !props.chapterId) return;

    const newPromise: PlotPromise = {
      id: `plot_promises:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      project_id: props.project,
      chapter_id: props.chapterId,
      kind: payload.kind,
      quote: payload.quote,
      paragraph_index: payload.paragraph_index,
      block_id: payload.block_id || null,
      note: null,
      status: 'planted',
      progressions: [],
      resolution: null,
      resolved_in_volume: null,
      resolved_in_chapter: null
    };

    try {
      const created = await api.savePlotPromise(props.project, newPromise);
      if (created) {
        promises.value.push(created);
      } else {
        promises.value.push(newPromise);
      }
    } catch {
      promises.value.push(newPromise);
    }
    syncLocalBackup();
    emit('change');
  };

  const addMilestone = async (payload: {
    promiseId: string;
    stage: 'progression' | 'resolution';
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
    chapterId?: string | null;
  }) => {
    const targetClean = cleanId(payload.promiseId);
    const target = promises.value.find((p) => cleanId(p.id) === targetClean);
    if (!target) return;

    const chapId = payload.chapterId || props.chapterId || target.chapter_id;
    const milestone: PromiseMilestone = {
      id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chapter_id: chapId,
      paragraph_index: payload.paragraph_index || 1,
      quote: payload.quote,
      created_at: new Date().toISOString()
    };

    if (payload.stage === 'progression') {
      if (!Array.isArray(target.progressions)) {
        target.progressions = [];
      }
      target.progressions.push(milestone);
      if (target.status === 'planted') {
        target.status = 'developed';
      }
    } else if (payload.stage === 'resolution') {
      target.resolution = milestone;
      target.status = 'resolved';
      target.resolved_in_chapter = chapId;
      target.resolved_in_volume = props.currentVolumeId || null;
    }

    try {
      await api.savePlotPromise(props.project, target);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const removeMilestone = async (
    promise: PlotPromise,
    milestoneId: string,
    stage: 'progression' | 'resolution'
  ) => {
    if (stage === 'progression' && Array.isArray(promise.progressions)) {
      promise.progressions = promise.progressions.filter((m) => m.id !== milestoneId);
      if (promise.progressions.length === 0 && promise.status === 'developed') {
        promise.status = 'planted';
      }
    } else if (stage === 'resolution') {
      promise.resolution = null;
      promise.status = (promise.progressions && promise.progressions.length > 0) ? 'developed' : 'planted';
      promise.resolved_in_chapter = null;
      promise.resolved_in_volume = null;
    }

    try {
      await api.savePlotPromise(props.project, promise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const updateStatus = async (item: PlotPromise, newStatus: string) => {
    if (!item.id || item.status === newStatus) return;
    item.status = newStatus;

    if (newStatus === 'resolved' && props.chapterId) {
      item.resolved_in_chapter = props.chapterId;
      item.resolved_in_volume = props.currentVolumeId || null;
    }

    try {
      await api.savePlotPromise(props.project, item);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const startEditNote = (item: PlotPromise) => {
    editingNoteId.value = item.id;
    noteDraft.value = item.note || '';
  };

  const saveNote = async (item: PlotPromise) => {
    item.note = noteDraft.value.trim() || null;
    editingNoteId.value = null;
    try {
      await api.savePlotPromise(props.project, item);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const cancelEditNote = () => {
    editingNoteId.value = null;
    noteDraft.value = '';
  };

  const removePromise = async (item: PlotPromise) => {
    if (!item.id) return;
    try {
      await api.deletePlotPromise(item.id);
    } catch { /* fallback to local */ }
    promises.value = promises.value.filter((p) => p.id !== item.id);
    syncLocalBackup();
    emit('change');
  };

  const locateSource = (item: { chapter_id: string; paragraph_index: number; quote: string; block_id?: string | null }) => {
    emit('locate', {
      chapterId: item.chapter_id,
      paragraphIndex: item.paragraph_index,
      quote: item.quote,
      blockId: item.block_id || undefined
    });
  };

  watch(() => props.project, loadPromises);
  onMounted(loadPromises);

  const promptAttachMilestone = (item: PlotPromise, stage: 'progression' | 'resolution') => {
    if (!item.id) return;
    const sel = window.getSelection()?.toString().trim();
    const quote = sel || prompt(stage === 'progression' ? 'Введите цитату/текст упоминания:' : 'Введите цитату кульминации/выстрела:');
    if (!quote) return;

    void addMilestone({
      promiseId: item.id,
      stage,
      quote,
      paragraph_index: 1,
      chapterId: props.chapterId || undefined
    });
  };

  return {
    isCollapsed,
    promises,
    chapterPromises: filtering.chapterPromises,
    filteredPromises: filtering.filteredPromises,
    loading,
    editingNoteId,
    noteDraft,
    scopeFilter: filtering.scopeFilter,
    statusFilter: filtering.statusFilter,
    loadPromises,
    addPromise,
    addMilestone,
    removeMilestone,
    updateStatus,
    startEditNote,
    saveNote,
    cancelEditNote,
    removePromise,
    locateSource,
    getKindInfo: filtering.getKindInfo,
    getChapterTitle: filtering.getChapterTitle,
    isCurrentChapterPromise: filtering.isCurrentChapterPromise,
    promptAttachMilestone
  };
}
