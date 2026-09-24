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
    });

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
  });
});
