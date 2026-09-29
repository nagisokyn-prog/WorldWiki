import { ref } from 'vue';
import * as api from '@/services/api.client';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import { cleanId } from './usePromiseFiltering';
import type { RichPlotPromise, PromiseMilestone, UsePromiseActionsParams } from './PromiseActions.model';

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

  const persist = async (item: RichPlotPromise, logMsg: string) => {
    try {
      console.log(logMsg, { project: getProject(), item });
      await api.savePlotPromise(getProject(), item as unknown as PlotPromise);
    } catch (err) {
      console.error(`[usePromiseActions ERROR] Failed: ${logMsg}`, err);
    }
    syncLocalBackup();
    emit('change');
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
      arc_phase: null,
      arcs: null,
      m_abs: null,
      calendar_id: null,
      date_fields: null
    };

    try {
      const created = await api.savePlotPromise(project, newPromise as unknown as PlotPromise);
      promises.value.push({
        ...newPromise,
        ...((created as unknown as Partial<RichPlotPromise>) || {})
      });
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
    const target = promises.value.find((p) => cleanId(p.id) === cleanId(payload.promiseId));
    if (!target) return;
    
    const chapId = payload.chapterId || params.chapterId || target.chapter_id;
    const ms: PromiseMilestone = {
      id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chapter_id: chapId,
      paragraph_index: payload.paragraph_index || 1,
      quote: payload.quote,
      created_at: new Date().toISOString()
    };

    if (payload.stage === 'progression') {
      target.progressions = [...(target.progressions || []), ms];
      if (target.status === 'planted') {
        target.status = 'developed';
      }
    } else {
      target.resolution = ms;
      target.status = 'resolved';
      target.resolved_in_chapter = chapId;
      target.resolved_in_volume = params.currentVolumeId || null;
    }
    await persist(target, '[usePromiseActions] Saving milestone update');
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
      promise.status = promise.progressions?.length ? 'developed' : 'planted';
      promise.resolved_in_chapter = null;
      promise.resolved_in_volume = null;
    }
    await persist(promise, '[usePromiseActions] Removing milestone');
  };

  const updateStatus = async (item: RichPlotPromise, newStatus: string) => {
    if (!item.id || item.status === newStatus) return;
    item.status = newStatus;
    if (newStatus === 'resolved' && params.chapterId) {
      item.resolved_in_chapter = params.chapterId;
      item.resolved_in_volume = params.currentVolumeId || null;
    }
    await persist(item, '[usePromiseActions] Updating status');
  };

  const startEditNote = (item: RichPlotPromise) => {
    editingNoteId.value = item.id;
    noteDraft.value = item.note || '';
  };

  const saveNote = async (item: RichPlotPromise) => {
    item.note = noteDraft.value.trim() || null;
    editingNoteId.value = null;
    await persist(item, '[usePromiseActions] Saving note');
  };

  const cancelEditNote = () => {
    editingNoteId.value = null;
    noteDraft.value = '';
  };

  const removePromise = async (item: RichPlotPromise) => {
    if (!item.id) return;
    try {
      await api.deletePlotPromise(item.id);
    } catch { /* ignore */ }
    promises.value = promises.value.filter((p) => p.id !== item.id);
    syncLocalBackup();
    emit('change');
  };

  const locateSource = (item: {
    chapter_id: string;
    paragraph_index: number;
    quote: string;
    block_id?: string | null;
  }) => {
    emit('locate', {
      chapterId: item.chapter_id,
      paragraphIndex: item.paragraph_index,
      quote: item.quote,
      blockId: item.block_id || undefined
    });
  };

  const promptAttachMilestone = (item: RichPlotPromise, stage: 'progression' | 'resolution') => {
    if (!item.id) return;
    const quote = window.getSelection()?.toString().trim() || 
      prompt(stage === 'progression' ? 'Введите цитату:' : 'Введите развязку:');
    if (quote) {
      void addMilestone({
        promiseId: item.id,
        stage,
        quote,
        paragraph_index: 1,
        chapterId: params.chapterId || undefined
      });
    }
  };

  const updatePromise = async (updatedItem: RichPlotPromise) => {
    if (!updatedItem.id) return;
    const index = promises.value.findIndex((p) => p.id === updatedItem.id);
    if (index !== -1) {
      promises.value[index] = { ...updatedItem };
    }
    await persist(updatedItem, '[usePromiseActions] Updating promise/scene metadata');
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

