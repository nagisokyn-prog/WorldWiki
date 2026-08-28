import { ref, computed, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import type { PlotPromise } from '@/types/generated/PlotPromise';

export interface PromisesPanelProps {
  project: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  currentVolumeId?: string | null;
  currentArcId?: string | null;
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
    (e: 'locate', payload: { paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
  }
) {
  const promises = ref<PlotPromise[]>([]);
  const loading = ref(false);
  const editingNoteId = ref<string | null>(null);
  const noteDraft = ref('');

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

  const chapterPromises = computed(() => {
    if (!props.chapterId) return [];
    const rawTarget = props.chapterId.replace(/^chapters:/, '');
    return promises.value.filter((p) => {
      const pChap = (p.chapter_id || '').replace(/^chapters:/, '');
      return pChap === rawTarget || p.chapter_id === props.chapterId;
    });
  });

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

  const updateStatus = async (item: PlotPromise, newStatus: string) => {
    if (!item.id || item.status === newStatus) return;
    const oldStatus = item.status;
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

  const locateSource = (item: PlotPromise) => {
    emit('locate', {
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
    loading,
    editingNoteId,
    noteDraft,
    loadPromises,
    addPromise,
    updateStatus,
    startEditNote,
    saveNote,
    cancelEditNote,
    removePromise,
    locateSource,
    getKindInfo
  };
}
