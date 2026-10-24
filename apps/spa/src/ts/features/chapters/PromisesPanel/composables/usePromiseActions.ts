import { ref } from 'vue';
import { plotApi } from '@/services/api/plot.api';
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
    } catch (err) {
      console.warn('[usePromiseActions] Failed to backup promises to localStorage:', err);
    }
  };

  const persist = async (item: RichPlotPromise, logMsg: string) => {
    try {
      console.log(logMsg, { project: getProject(), item });
      const payload: PlotPromise = {
        ...(item as unknown as PlotPromise),
        arcs: Array.isArray(item.arcs) ? item.arcs : [],
        arc_id: typeof item.arc_id === 'string' ? item.arc_id : null,
        arc_phase: typeof item.arc_phase === 'string' ? item.arc_phase : null,
      };
      await plotApi.savePlotPromise(getProject(), payload);
    } catch (err) {
      console.error(`[usePromiseActions ERROR] Failed: ${logMsg}`, err, {
        errorMsg: err instanceof Error ? err.message : String(err),
        item,
        payload
      });
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
      kind: payload.kind,
      title: payload.quote,
      note: null,
      status: 'planted',
      location_id: null,
      timeline_event_id: null,
      m_abs: null,
      calendar_id: null,
      participant_ids: [],
      arcs: [],
      arc_id: null,
      arc_phase: null,
      milestones: [
        {
          milestone_id: `ms_${Date.now()}`,
          stage: 'plant',
          quote: payload.quote,
          note: null,
          block_id: payload.block_id || '',
          chapter_id: chapterId || null,
          order_index: payload.paragraph_index
        }
      ],
      chapter_id: chapterId,
      quote: payload.quote,
      paragraph_index: payload.paragraph_index,
      block_id: payload.block_id || null,
      progressions: [],
      resolution: null,
      resolved_in_volume: null,
      resolved_in_chapter: null
    };

    try {
      const created = await plotApi.savePlotPromise(project, newPromise as unknown as PlotPromise);
      promises.value.push({
        ...newPromise,
        ...((created as unknown as Partial<RichPlotPromise>) || {})
      });
    } catch (err) {
      console.warn('[usePromiseActions] Failed to persist new promise to backend, keeping local state:', err);
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
      milestone_id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stage: payload.stage,
      chapter_id: chapId || null,
      paragraph_index: payload.paragraph_index || 1,
      order_index: payload.paragraph_index || 1,
      quote: payload.quote,
      note: null,
      block_id: payload.block_id || '',
      created_at: new Date().toISOString()
    };

    target.milestones = Array.isArray(target.milestones) ? target.milestones : [];
    target.milestones.push(ms);

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
    promise.milestones = (promise.milestones || []).filter(
      (m) => m.milestone_id !== milestoneId && (m as { id?: string }).id !== milestoneId
    );
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
      await plotApi.deletePlotPromise(item.id);
    } catch (err) {
      console.warn('[usePromiseActions] Failed to delete promise from backend:', err);
    }
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
    const targetClean = cleanId(updatedItem.id);
    const index = promises.value.findIndex((p) => p.id === updatedItem.id || cleanId(p.id) === targetClean);
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

