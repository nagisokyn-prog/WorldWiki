import { ref, onUnmounted } from 'vue';
import { plotApi } from '@/services/api/plot.api';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import { cleanId } from './usePromiseFiltering';
import type { RichPlotPromise, PromiseMilestone, UsePromiseActionsParams } from './PromiseActions.model';

import { preparePromisePayload, createNewPromiseRecord, syncPromisesToLocalStorage } from './usePromisePayloadBuilder';

export function usePromiseActions(params: UsePromiseActionsParams) {
  const { promises, emit } = params;
  const editingNoteId = ref<string | null>(null);
  const noteDraft = ref('');

  const getProject = () => params.props?.project ?? params.project ?? '';
  const getChapterId = () => (params.props?.chapterId !== undefined ? params.props.chapterId : params.chapterId) ?? null;

  const syncLocalBackup = () => syncPromisesToLocalStorage(getProject(), promises.value);

  let persistQueue = Promise.resolve();
  const updatePromiseDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

  onUnmounted(() => {
    for (const timer of updatePromiseDebounceMap.values()) {
      clearTimeout(timer);
    }
    updatePromiseDebounceMap.clear();
  });

  const persist = (item: RichPlotPromise, logMsg: string): Promise<void> => {
    persistQueue = persistQueue.then(async () => {
      let payloadForLog: PlotPromise | null = null;
      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        try {
          console.log(logMsg, { project: getProject(), item });
          const payload = preparePromisePayload(item, getChapterId());
          payloadForLog = payload;
          const saved = (await plotApi.savePlotPromise(getProject(), payload)) as RichPlotPromise | null;
          if (saved) {
            const cleanSavedId = cleanId(item.id);
            const idx = promises.value.findIndex((p) => p.id === item.id || cleanId(p.id) === cleanSavedId);
            if (idx !== -1) {
              promises.value[idx] = {
                ...promises.value[idx],
                timeline_event_id: saved.timeline_event_id || promises.value[idx].timeline_event_id,
                m_abs: saved.m_abs ?? promises.value[idx].m_abs,
                calendar_id: saved.calendar_id || promises.value[idx].calendar_id
              };
            }
          }
          break;
        } catch (err) {
          const errStr = err instanceof Error ? err.message : String(err);
          const isConflict =
            errStr.includes('Transaction conflict') ||
            errStr.includes('write conflict') ||
            (typeof err === 'object' && err !== null && JSON.stringify(err).includes('conflict'));
          if (isConflict && attempts < 4) {
            await new Promise((r) => setTimeout(r, attempts * 150));
            continue;
          }
          console.error(`[usePromiseActions ERROR] Failed: ${logMsg}`, err, {
            errorMsg: errStr,
            item,
            payload: payloadForLog
          });
          break;
        }
      }
      syncLocalBackup();
      emit('change');
    }).catch((qErr) => {
      console.warn('[usePromiseActions] Queue error:', qErr);
    });
    return persistQueue;
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

    const newPromise = createNewPromiseRecord(project, chapterId, payload);

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

  const locateSource = (item: { chapter_id?: string | null; paragraph_index?: number | null; quote?: string | null; block_id?: string | null }) => {
    emit('locate', {
      chapterId: item.chapter_id || getChapterId() || '',
      paragraphIndex: item.paragraph_index ?? 1,
      quote: item.quote || '',
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

  const updatePromise = async (updatedItem: RichPlotPromise, immediate = false) => {
    if (!updatedItem.id) return;
    const targetClean = cleanId(updatedItem.id);
    const index = promises.value.findIndex((p) => p.id === updatedItem.id || cleanId(p.id) === targetClean);
    if (index !== -1) {
      promises.value[index] = { ...updatedItem };
    }
    syncLocalBackup();
    emit('change');

    const existingTimer = updatePromiseDebounceMap.get(targetClean);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    if (immediate) {
      updatePromiseDebounceMap.delete(targetClean);
      return persist(updatedItem, '[usePromiseActions] Updating promise/scene metadata');
    }
    const timer = setTimeout(() => {
      updatePromiseDebounceMap.delete(targetClean);
      void persist(updatedItem, '[usePromiseActions] Updating promise/scene metadata');
    }, 250);
    updatePromiseDebounceMap.set(targetClean, timer);
  };

  const addNewScene = () => {
    return addPromise({
      kind: 'scene',
      quote: 'Новая сцена',
      paragraph_index: 1
    });
  };

  const addSubScene = async (
    parentItem: RichPlotPromise,
    payload: {
      quote: string;
      paragraph_index: number;
      block_id?: string | null;
      chapterId?: string | null;
    }
  ) => {
    const project = getProject();
    const chapterId = payload.chapterId || getChapterId() || parentItem.chapter_id || null;
    if (!project || !chapterId) return;

    const newSubScene = createNewPromiseRecord(project, chapterId, {
      kind: 'scene',
      quote: payload.quote,
      paragraph_index: payload.paragraph_index,
      block_id: payload.block_id,
      parent_id: parentItem.id,
      location_id: parentItem.location_id,
      participant_ids: parentItem.participant_ids ? [...parentItem.participant_ids] : [],
      arcs: parentItem.arcs ? [...parentItem.arcs] : [],
      time_nature: parentItem.time_nature || 'present',
      m_abs: parentItem.m_abs,
      calendar_id: parentItem.calendar_id
    });

    try {
      const created = await plotApi.savePlotPromise(project, newSubScene as unknown as PlotPromise);
      promises.value.push({
        ...newSubScene,
        ...((created as unknown as Partial<RichPlotPromise>) || {})
      });
    } catch (err) {
      console.warn('[usePromiseActions] Failed to persist sub-scene to backend:', err);
      promises.value.push(newSubScene);
    }
    syncLocalBackup();
    emit('change');
  };

  return {
    editingNoteId,
    noteDraft,
    syncLocalBackup,
    addPromise,
    addNewScene,
    addSubScene,
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

