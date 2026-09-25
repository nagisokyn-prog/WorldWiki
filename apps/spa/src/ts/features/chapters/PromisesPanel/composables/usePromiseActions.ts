import { ref, type Ref } from 'vue';
import * as api from '@/services/api.client';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import { cleanId } from './usePromiseFiltering';

export interface PromiseMilestone {
  id: string;
  chapter_id: string;
  paragraph_index: number;
  quote: string;
  note?: string | null;
  created_at?: string | null;
}

export type RichPlotPromise = Omit<PlotPromise, 'progressions' | 'resolution'> & {
  progressions?: PromiseMilestone[] | null;
  resolution?: PromiseMilestone | null;
  /** UI-флаг: текст был удалён из рукописи (не сохраняется в БД) */
  is_orphaned?: boolean;
};

export interface UsePromiseActionsParams {
  project?: string;
  chapterId?: string | null;
  currentVolumeId?: string | null;
  props?: { project?: string; chapterId?: string | null; currentVolumeId?: string | null };
  promises: Ref<RichPlotPromise[]>;
  emit: {
    (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
  };
}

export function usePromiseActions(params: UsePromiseActionsParams) {
  const { promises, emit } = params;
  const editingNoteId = ref<string | null>(null);
  const noteDraft = ref('');

  const getProject = () => params.props?.project ?? params.project ?? '';
  const getChapterId = () => (params.props?.chapterId !== undefined ? params.props.chapterId : params.chapterId) ?? null;

  const syncLocalBackup = () => {
    const proj = getProject();
    if (!proj) return;
    try {
      localStorage.setItem(`ww_plot_promises_${proj}`, JSON.stringify(promises.value));
    } catch { /* ignore */ }
  };

  const addPromise = async (payload: {
    kind: string;
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
  }) => {
    const project = getProject();
    const chapterId = getChapterId();
    if (!project || !chapterId) return;

    const newPromise: RichPlotPromise = {
      id: `plot_promises:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      project_id: project,
      chapter_id: chapterId,
      kind: payload.kind,
      quote: payload.quote,
      paragraph_index: payload.paragraph_index,
      block_id: payload.block_id || null,
      note: null,
      status: 'planted',
      progressions: [],
      resolution: null,
      resolved_in_volume: null,
      resolved_in_chapter: null,
      participant_ids: null,
      location_id: null,
      timeline_event_id: null,
      arc_id: null,
      arc_phase: null
    };

    try {
      const created = await api.savePlotPromise(params.project || '', newPromise as unknown as PlotPromise);
      if (created) {
        promises.value.push(created as unknown as RichPlotPromise);
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

    const chapId = payload.chapterId || params.chapterId || target.chapter_id;
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
      target.resolved_in_volume = params.currentVolumeId || null;
    }

    try {
      await api.savePlotPromise(params.project || '', target as unknown as PlotPromise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const removeMilestone = async (
    promise: RichPlotPromise,
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
      await api.savePlotPromise(params.project || '', promise as unknown as PlotPromise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const updateStatus = async (item: RichPlotPromise, newStatus: string) => {
    if (!item.id || item.status === newStatus) return;
    item.status = newStatus;

    if (newStatus === 'resolved' && params.chapterId) {
      item.resolved_in_chapter = params.chapterId;
      item.resolved_in_volume = params.currentVolumeId || null;
    }

    try {
      await api.savePlotPromise(params.project || '', item as unknown as PlotPromise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const startEditNote = (item: RichPlotPromise) => {
    editingNoteId.value = item.id;
    noteDraft.value = item.note || '';
  };

  const saveNote = async (item: RichPlotPromise) => {
    item.note = noteDraft.value.trim() || null;
    editingNoteId.value = null;
    try {
      await api.savePlotPromise(params.project || '', item as unknown as PlotPromise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const cancelEditNote = () => {
    editingNoteId.value = null;
    noteDraft.value = '';
  };

  const removePromise = async (item: RichPlotPromise) => {
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

  const promptAttachMilestone = (item: RichPlotPromise, stage: 'progression' | 'resolution') => {
    if (!item.id) return;
    const sel = window.getSelection()?.toString().trim();
    const quote = sel || prompt(stage === 'progression' ? 'Введите цитату/текст упоминания:' : 'Введите цитату кульминации/выстрела:');
    if (!quote) return;

    void addMilestone({
      promiseId: item.id,
      stage,
      quote,
      paragraph_index: 1,
      chapterId: params.chapterId || undefined
    });
  };

  const updatePromise = async (updatedItem: RichPlotPromise) => {
    if (!updatedItem.id) return;
    const index = promises.value.findIndex((p) => p.id === updatedItem.id);
    if (index !== -1) {
      promises.value[index] = { ...updatedItem };
    }
    try {
      await api.savePlotPromise(getProject(), updatedItem as unknown as PlotPromise);
    } catch { /* fallback to local */ }
    syncLocalBackup();
    emit('change');
  };

  const addNewScene = () => {
    return addPromise({
      kind: 'scene',
      quote: 'Новая сцена',
      paragraph_index: 1
    });
  };

  return {
    editingNoteId,
    noteDraft,
    syncLocalBackup,
    addPromise,
    addNewScene,
    updatePromise,
    addMilestone,
    removeMilestone,
    updateStatus,
    startEditNote,
    saveNote,
    cancelEditNote,
    removePromise,
    locateSource,
    promptAttachMilestone
  };
}

