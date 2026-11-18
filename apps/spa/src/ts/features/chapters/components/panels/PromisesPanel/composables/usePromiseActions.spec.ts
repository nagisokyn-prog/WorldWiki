import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { usePromiseActions, type RichPlotPromise } from './usePromiseActions';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  savePlotPromise: vi.fn(),
  deletePlotPromise: vi.fn()
}));

describe('usePromiseActions', () => {
  const promises = ref<RichPlotPromise[]>([]);
  let emitMock = vi.fn();

  beforeEach(() => {
    promises.value = [];
    emitMock = vi.fn();
    vi.clearAllMocks();
  });

  it('addPromise creates a new promise and emits change', async () => {
    vi.mocked(api.savePlotPromise).mockResolvedValue({ id: 'plot_promises:123' } as any);

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as any
    });

    await actions.addPromise({
      kind: 'clue',
      quote: 'Найден старинный ключ',
      paragraph_index: 3
    });

    expect(promises.value.length).toBe(1);
    expect(promises.value[0].kind).toBe('clue');
    expect(promises.value[0].quote).toBe('Найден старинный ключ');
    expect(emitMock).toHaveBeenCalledWith('change');
  });

  it('addNewScene creates a scene item with default title', async () => {
    vi.mocked(api.savePlotPromise).mockResolvedValue({ id: 'plot_promises:scene_1' } as any);

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as any
    });

    await actions.addNewScene();

    expect(promises.value.length).toBe(1);
    expect(promises.value[0].kind).toBe('scene');
    expect(promises.value[0].quote).toBe('Новая сцена');
  });

  it('updatePromise updates state and calls api', async () => {
    const initial: RichPlotPromise = {
      id: 'plot_promises:item1',
      project_id: 'proj-1',
      chapter_id: 'chap-1',
      kind: 'scene',
      quote: 'Старая сцена',
      paragraph_index: 1,
      status: 'planted'
    };
    promises.value = [initial];

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as any
    });

    await actions.updatePromise({
      ...initial,
      location_id: 'В тронном зале',
      participant_ids: ['Гендальф']
    }, true);

    expect(promises.value[0].location_id).toBe('В тронном зале');
    expect(promises.value[0].participant_ids).toEqual(['Гендальф']);
    expect(api.savePlotPromise).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      location_id: 'В тронном зале'
    }));
    expect(emitMock).toHaveBeenCalledWith('change');
  });

  it('addMilestone for progression updates status to developed', async () => {
    const item: RichPlotPromise = {
      id: 'plot_promises:item1',
      project_id: 'proj-1',
      chapter_id: 'chap-1',
      kind: 'chekhov_gun',
      quote: 'Пистолет на стене',
      paragraph_index: 1,
      status: 'planted'
    };
    promises.value = [item];

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as any
    });

    await actions.addMilestone({
      promiseId: 'plot_promises:item1',
      stage: 'progression',
      quote: 'Герой снял пистолет',
      paragraph_index: 5
    });

    expect(promises.value[0].status).toBe('developed');
    expect(promises.value[0].progressions?.length).toBe(1);
    expect(promises.value[0].progressions?.[0].quote).toBe('Герой снял пистолет');
  });

  it('startEditNote, saveNote and cancelEditNote works properly', async () => {
    const item: RichPlotPromise = {
      id: 'plot_promises:item1',
      project_id: 'proj-1',
      chapter_id: 'chap-1',
      kind: 'mystery',
      quote: 'Тайна шкатулки',
      paragraph_index: 1,
      status: 'planted'
    };
    promises.value = [item];

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as any
    });

    actions.startEditNote(item);
    expect(actions.editingNoteId.value).toBe('plot_promises:item1');
    actions.noteDraft.value = 'Важная заметка о шкатулке';

    await actions.saveNote(item);
    expect(item.note).toBe('Важная заметка о шкатулке');
    expect(actions.editingNoteId.value).toBeNull();

    actions.startEditNote(item);
    actions.cancelEditNote();
    expect(actions.editingNoteId.value).toBeNull();
  });

  it('covers updatePromise (debounced & immediate), addNewScene, and addSubScene (success & fallback)', async () => {
    vi.useFakeTimers();
    const { plotApi } = await import('@/services/api/plot.api');
    const saveSpy = vi.spyOn(plotApi, 'savePlotPromise').mockResolvedValue({ id: 'plot_promises:sub1' } as never);

    const parent: RichPlotPromise = {
      id: 'plot_promises:item1',
      project_id: 'proj-1',
      chapter_id: 'chap-1',
      kind: 'gun',
      quote: 'Ружьё',
      paragraph_index: 1,
      status: 'planted',
    };
    promises.value = [parent];

    const actions = usePromiseActions({
      project: 'proj-1',
      chapterId: 'chap-1',
      promises,
      emit: emitMock as never,
    });

    // Debounced updatePromise
    void actions.updatePromise({ ...parent, quote: 'Ружьё 2' }, false);
    vi.advanceTimersByTime(260);
    expect(promises.value[0].quote).toBe('Ружьё 2');

    // Immediate updatePromise
    await actions.updatePromise({ ...parent, quote: 'Ружьё 3' }, true);
    expect(promises.value[0].quote).toBe('Ружьё 3');

    await actions.addNewScene();
    expect(promises.value.some((p) => p.kind === 'scene')).toBe(true);

    await actions.addSubScene(parent, { quote: 'Подсцена', paragraph_index: 2 });
    expect(promises.value.some((p) => p.quote === 'Подсцена')).toBe(true);

    // Fallback when savePlotPromise rejects on addSubScene
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSpy.mockRejectedValueOnce(new Error('net err'));
    await actions.addSubScene(parent, { quote: 'Подсцена оффлайн', paragraph_index: 3 });
    expect(promises.value.some((p) => p.quote === 'Подсцена оффлайн')).toBe(true);

    warnSpy.mockRestore();
    saveSpy.mockRestore();
    vi.useRealTimers();
  });

  it('covers remaining branches: planted resolve, deleteMilestone progression/resolution, status resolved, inline prompt, missing ids, and subscene arrays', async () => {
    vi.useFakeTimers();
    const { plotApi } = await import('@/services/api/plot.api');
    const saveSpy = vi.spyOn(plotApi, 'savePlotPromise').mockResolvedValue({ id: 'plot_promises:sub2' } as never);
    const getSelSpy = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as never);
    const origPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValueOnce('Новая цитата').mockReturnValueOnce('');

    const p1: RichPlotPromise = {
      id: 'plot_promises:p1',
      project_id: 'proj-1',
      chapter_id: 'chap-1',
      kind: 'gun',
      quote: 'Q1',
      paragraph_index: 1,
      status: 'planted',
      progressions: [{ milestone_id: 'm1', quote: 'M1', chapter_id: 'chap-1', paragraph_index: 2 }],
      resolution: { milestone_id: 'r1', quote: 'R1', chapter_id: 'chap-1', paragraph_index: 3 },
      participant_ids: ['c1'],
      arcs: [{ arc_id: 'a1', arc_title: 'Arc' }] as never,
    };
    promises.value = [p1];

    const actions = usePromiseActions({
      props: { project: 'proj-1' } as never,
      chapterId: 'chap-1',
      currentVolumeId: 'vol-1',
      promises,
      emit: emitMock as never,
    });

    // addMilestone (progression on planted -> developed, and resolution -> sets resolved_in_volume)
    await actions.addMilestone({ promiseId: 'p1', stage: 'progression', quote: 'Prog', paragraph_index: 2 });
    expect(promises.value[0].status).toBe('developed');
    await actions.addMilestone({ promiseId: 'p1', stage: 'resolution', quote: 'Final', chapterId: '', paragraph_index: 0 });
    expect(promises.value[0].status).toBe('resolved');

    // removeMilestone on progression (developed -> planted) and resolution
    promises.value[0].progressions = [{ milestone_id: 'm1', stage: 'progression', quote: 'M1', chapter_id: 'chap-1', paragraph_index: 2 }];
    promises.value[0].status = 'developed';
    await actions.removeMilestone(promises.value[0], 'm1', 'progression');
    expect(promises.value[0].status).toBe('planted');

    promises.value[0].progressions = [{ milestone_id: 'm2', stage: 'progression', quote: 'M2', chapter_id: 'chap-1', paragraph_index: 2 }];
    promises.value[0].status = 'resolved';
    await actions.removeMilestone(promises.value[0], 'r1', 'resolution');
    expect(promises.value[0].status).toBe('developed');

    // updateStatus -> 'resolved' with chapterId
    await actions.updateStatus(promises.value[0], 'resolved');
    expect(promises.value[0].status).toBe('resolved');

    // triggerInlineUpdate guards & prompt paths
    await actions.triggerInlineUpdate({ id: '' } as never, 'progression');
    await actions.triggerInlineUpdate(p1, 'progression');
    await actions.triggerInlineUpdate(p1, 'resolution');

    // saveUpdatedItem guards (!id and not found)
    await actions.saveUpdatedItem({ id: '' } as never);
    await actions.saveUpdatedItem({ id: 'plot_promises:nonexistent' } as never);

    // updatePromise debounced twice (clears existingTimer)
    void actions.updatePromise({ ...p1, quote: 'A' }, false);
    void actions.updatePromise({ ...p1, quote: 'B' }, false);
    vi.advanceTimersByTime(300);

    // addSubScene guard (!chapterId) & with participant_ids/arcs
    const noChapActions = usePromiseActions({ promises, emit: emitMock as never });
    await noChapActions.addSubScene(p1, { quote: 'Skip' });
    await actions.addSubScene(p1, { quote: 'SubWithArrays' });
    expect(promises.value.some((p) => p.quote === 'SubWithArrays')).toBe(true);

    getSelSpy.mockRestore();
    window.prompt = origPrompt;
    saveSpy.mockRestore();
    vi.useRealTimers();
  });
});
