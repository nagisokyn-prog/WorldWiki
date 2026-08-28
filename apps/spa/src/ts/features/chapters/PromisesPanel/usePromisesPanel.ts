import { ref, computed, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import type { PlotPromise, PromiseMilestone } from '@/types/generated/PlotPromise';

export interface ChapterMetaItem {
  id: string | null;
  title: string;
  [key: string]: unknown;
}

export interface PromisesPanelProps {
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  currentArcId?: string | null;
  allChapters?: ChapterMetaItem[];
}

export const PROMISE_KINDS: Record<string, { label: string; icon: string }> = {
  gun: { label: 'Чеховское ружьё', icon: '🔫' },
  foreshadowing: { label: 'Предзнаменование', icon: '🔮' },
  mystery: { label: 'Тайна', icon: '🗝️' },
  question: { label: 'Нераскрытый вопрос', icon: '❓' }
};

export const PROMISE_STATUSES: Array<{ id: string; label: string; icon: string }> = [
  { id: 'planted', label: 'Посажено', icon: '🌱' },
  { id: 'developed', label: 'Развито', icon: '🌿' },
  { id: 'resolved', label: 'Отстреляно', icon: '🎯' }
];

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
  const scopeFilter = ref<'all' | 'current'>('all');
  const statusFilter = ref<'all' | 'planted' | 'developed' | 'resolved'>('all');

  const cleanId = (id: unknown): string => {
    if (!id) return '';
    const s = typeof id === 'string' ? id : ((id as { id?: { String?: string } | string }).id || JSON.stringify(id));
    const parts = String(s).split(':');
    return (parts[parts.length - 1] || String(s)).replace(/["'`]/g, '').trim();
  };

  const loadPromises = async () => {
    if (!props.project) return;
    loading.value = true;
    try {
      const list = await api.getPlotPromises(props.project);
      promises.value = Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[PromisesPanel] Failed to load plot promises from backend (restart backend to apply Rust changes):', e);
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

  const isCurrentChapterPromise = (promiseChapterId: string) => {
    if (!props.chapterId) return false;
    return cleanId(props.chapterId) === cleanId(promiseChapterId);
  };

  const chapterPromises = computed(() => {
    if (!props.chapterId) return [];
    return promises.value.filter((p) => isCurrentChapterPromise(p.chapter_id));
  });

  const filteredPromises = computed(() => {
    let list = promises.value;

    if (scopeFilter.value === 'current') {
      list = chapterPromises.value;
    }

    if (statusFilter.value !== 'all') {
      list = list.filter((p) => p.status === statusFilter.value);
    }

    return list;
  });

  const getChapterTitle = (chapterId: string) => {
    if (!chapterId) return 'Глава';
    if (props.chapterId && isCurrentChapterPromise(chapterId) && props.chapterTitle) {
      return props.chapterTitle;
    }
    const targetClean = cleanId(chapterId);
    const found = props.allChapters?.find((c) => {
      return cleanId(c.id) === targetClean;
    });
    return found?.title || `Глава ${targetClean}`;
  };

  const addPromise = async (payload: {
    kind: string;
    quote: string;
    paragraph_index: number;
    block_id?: string;
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
      resolved_in_arc: null,
      resolved_in_chapter: null
    };

    try {
      const created = await api.savePlotPromise(props.project, newPromise);
      if (created) {
        promises.value.push(created);
      } else {
        promises.value.push(newPromise);
      }
    } catch (e) {
      console.warn('[PromisesPanel] Backend command save_plot_promise not yet available, saved locally:', e);
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
      target.resolved_in_arc = props.currentArcId || null;
    }

    try {
      await api.savePlotPromise(props.project, target);
    } catch (e) {
      console.warn('[PromisesPanel] Backend save milestone not available, saved locally:', e);
    }
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
      promise.resolved_in_arc = null;
    }

    try {
      await api.savePlotPromise(props.project, promise);
    } catch (e) {
      console.warn('[PromisesPanel] Backend delete milestone not available, saved locally:', e);
    }
    syncLocalBackup();
    emit('change');
  };

  const updateStatus = async (item: PlotPromise, newStatus: string) => {
    if (!item.id || item.status === newStatus) return;
    item.status = newStatus;

    if (newStatus === 'resolved' && props.chapterId) {
      item.resolved_in_chapter = props.chapterId;
      item.resolved_in_volume = props.currentVolumeId || null;
      item.resolved_in_arc = props.currentArcId || null;
    }

    try {
      await api.savePlotPromise(props.project, item);
    } catch (e) {
      console.warn('[PromisesPanel] Backend update not available, updated locally:', e);
    }
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
    } catch (e) {
      console.warn('[PromisesPanel] Backend save note not available, saved locally:', e);
    }
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
    } catch (e) {
      console.warn('[PromisesPanel] Backend delete not available, deleted locally:', e);
    }
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

  const getKindInfo = (kind: string) => {
    return PROMISE_KINDS[kind] || { label: kind, icon: '📌' };
  };

  watch(() => props.project, loadPromises);
  onMounted(loadPromises);

  return {
    promises,
    chapterPromises,
    filteredPromises,
    loading,
    editingNoteId,
    noteDraft,
    scopeFilter,
    statusFilter,
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
    getKindInfo,
    getChapterTitle,
    isCurrentChapterPromise
  };
}
