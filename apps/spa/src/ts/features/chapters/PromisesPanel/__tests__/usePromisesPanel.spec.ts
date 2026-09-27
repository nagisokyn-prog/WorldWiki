import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePromisesPanel, PROMISE_KINDS, PROMISE_STATUSES } from '../usePromisesPanel';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getPlotPromises: vi.fn(),
  savePlotPromise: vi.fn(),
  deletePlotPromise: vi.fn(),
}));

describe('usePromisesPanel', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    props = {
      project: 'proj_test',
      chapterId: 'ch_1',
      chapterTitle: 'Chapter One',
      currentVolumeId: 'vol_1',
      allChapters: [
        { id: 'ch_1', title: 'Chapter One' },
        { id: 'ch_2', title: 'Chapter Two' },
      ],
    };
    emit = vi.fn();
  });

  it('exports PROMISE_KINDS and PROMISE_STATUSES correctly', () => {
    expect(PROMISE_KINDS.gun.label).toBe('Чеховское ружьё');
    expect(PROMISE_STATUSES).toHaveLength(3);
  });

  it('loads promises from API on mount and handles localStorage fallback', async () => {
    const mockList = [
      { id: 'p1', chapter_id: 'ch_1', status: 'planted', kind: 'gun', quote: 'A gun on the wall' },
      { id: 'p2', chapter_id: 'ch_2', status: 'developed', kind: 'mystery', quote: 'A locked chest' },
    ];
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce(mockList as any);

    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    expect(panel.promises.value).toHaveLength(2);
    expect(panel.loading.value).toBe(false);

    // Test API failure with localStorage fallback
    localStorage.setItem('ww_plot_promises_proj_test', JSON.stringify([{ id: 'cached_p1' }]));
    vi.mocked(api.getPlotPromises).mockRejectedValueOnce(new Error('Network error'));
    await panel.loadPromises();
    expect(panel.promises.value).toEqual([{ id: 'cached_p1' }]);

    // Test empty project early return
    props.project = '';
    const emptyPanel = usePromisesPanel(props, emit);
    await emptyPanel.loadPromises();
    expect(emptyPanel.promises.value).toEqual([]);
  });

  it('synchronizes multi-paragraph scene quotes with edited manuscript paragraphs', async () => {
    // Цитата охватывает 3 параграфа через «—».
    // Якорь начала: 'Фраза раз' (до первого «—»).
    // Якорь конца:  'Фраза три' (после последнего «—»).
    // После редактирования первого параграфа результат — объединение обновлённых текстов.
    const mockList = [
      { id: 'p1', chapter_id: 'ch_1', status: 'planted', kind: 'scene', quote: 'Фраза раз — Фраза два — Фраза три', paragraph_index: 1 }
    ];
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce(mockList as any);

    props.chapterData = {
      id: 'ch_1',
      content: '<p>Фраза раз обновленная</p><p>Фраза два</p><p>Фраза три</p>'
    };

    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    // Якорь начала 'фраза раз' найден в 'фраза раз обновленная' ✓
    // Якорь конца  'фраза три' найден в 'фраза три' ✓
    expect(panel.promises.value[0].quote).toBe('Фраза раз обновленная\nФраза два\nФраза три');
    expect(panel.promises.value[0].paragraph_index).toBe(1);
  });

  it('synchronizes single-block promise via block_id without length restrictions', async () => {
    // block_id-путь: всегда синкает, даже если текст сильно вырос
    const mockList = [
      { id: 'p1', chapter_id: 'ch_1', status: 'planted', kind: 'gun', block_id: 'blk-abc', quote: 'Короткая', paragraph_index: 2 }
    ];
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce(mockList as any);

    props.chapterData = {
      id: 'ch_1',
      content: '<p data-block-id="blk-abc">Очень длинный обновлённый текст, который значительно превышает исходную длину оригинала</p>'
    };

    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    expect(panel.promises.value[0].quote).toBe('Очень длинный обновлённый текст, который значительно превышает исходную длину оригинала');
  });

  it('filters promises by scope (current vs all) and status', async () => {
    const mockList = [
      { id: 'p1', chapter_id: 'ch_1', status: 'planted', kind: 'gun', quote: 'Gun' },
      { id: 'p2', chapter_id: 'ch_2', status: 'developed', kind: 'mystery', quote: 'Mystery' },
      { id: 'p3', chapter_id: 'ch_1', status: 'resolved', kind: 'question', quote: 'Answer' },
    ];
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce(mockList as any);

    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    // Default: scopeFilter = 'all', statusFilter = 'all'
    expect(panel.filteredPromises.value).toHaveLength(3);
    expect(panel.chapterPromises.value).toHaveLength(2);

    // Current chapter only
    panel.scopeFilter.value = 'current';
    expect(panel.filteredPromises.value).toHaveLength(2);

    // Filter by status
    panel.statusFilter.value = 'planted';
    expect(panel.filteredPromises.value).toHaveLength(1);
    expect(panel.filteredPromises.value[0].id).toBe('p1');

    panel.statusFilter.value = 'resolved';
    expect(panel.filteredPromises.value).toHaveLength(1);
    expect(panel.filteredPromises.value[0].id).toBe('p3');

    // Without chapterId
    props.chapterId = null;
    const noChapPanel = usePromisesPanel(props, emit);
    expect(noChapPanel.chapterPromises.value).toEqual([]);
  });

  it('resolves chapter title correctly with various formats', () => {
    const panel = usePromisesPanel(props, emit);

    expect(panel.getChapterTitle('')).toBe('Глава');
    expect(panel.getChapterTitle('ch_1')).toBe('Chapter One');
    expect(panel.getChapterTitle('ch_2')).toBe('Chapter Two');
    expect(panel.getChapterTitle('ch_999')).toBe('Глава ch_999');

    props.chapterTitle = null;
    expect(panel.getChapterTitle('ch_1')).toBe('Chapter One');
  });

  it('adds a new promise and handles API success and failure', async () => {
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce([]);
    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    // Success from API
    const createdPromise = { id: 'p_new_1', quote: 'Test quote' };
    vi.mocked(api.savePlotPromise).mockResolvedValueOnce(createdPromise as any);

    await panel.addPromise({ kind: 'gun', quote: 'Test quote', paragraph_index: 2 });
    expect(panel.promises.value).toHaveLength(1);
    expect(panel.promises.value[0].id).toBe('p_new_1');
    expect(emit).toHaveBeenCalledWith('change');

    // Failure fallback
    vi.mocked(api.savePlotPromise).mockRejectedValueOnce(new Error('Save fail'));
    await panel.addPromise({ kind: 'mystery', quote: 'Second quote', paragraph_index: 3 });
    expect(panel.promises.value).toHaveLength(2);

    // Null returned from API (covers line 156)
    vi.mocked(api.savePlotPromise).mockResolvedValueOnce(null as any);
    await panel.addPromise({ kind: 'payoff', quote: 'Null return', paragraph_index: 4 });
    expect(panel.promises.value).toHaveLength(3);

    // Guard on empty project or chapterId
    props.chapterId = null;
    await panel.addPromise({ kind: 'gun', quote: 'Ignored', paragraph_index: 1 });
    expect(panel.promises.value).toHaveLength(3);
  });

  it('adds milestone for progression and resolution', async () => {
    const existing = {
      id: 'p1',
      chapter_id: 'ch_1',
      status: 'planted',
      kind: 'gun',
      quote: 'Gun',
      progressions: [],
    };
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce([existing] as any);
    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    // Progression milestone
    vi.mocked(api.savePlotPromise).mockResolvedValueOnce(existing as any);
    await panel.addMilestone({
      promiseId: 'p1',
      stage: 'progression',
      quote: 'Gun cleaned',
      paragraph_index: 5,
    });
    expect(existing.status).toBe('developed');
    expect(existing.progressions).toHaveLength(1);

    // Resolution milestone
    vi.mocked(api.savePlotPromise).mockResolvedValueOnce(existing as any);
    await panel.addMilestone({
      promiseId: 'p1',
      stage: 'resolution',
      quote: 'Gun fired',
      paragraph_index: 10,
    });
    expect(existing.status).toBe('resolved');
    expect(existing.resolution).toBeDefined();
    expect(existing.resolved_in_volume).toBe('vol_1');

    // Unknown promiseId does nothing
    await panel.addMilestone({
      promiseId: 'nonexistent',
      stage: 'progression',
      quote: 'Nothing',
      paragraph_index: 1,
    });

    // Progression when progressions is undefined (covers line 188)
    const noProg: any = {
      id: 'p_no_prog',
      chapter_id: 'ch_1',
      status: 'planted',
      kind: 'clue',
      quote: 'Clue',
      // progressions is undefined
    };
    panel.promises.value.push(noProg);
    await panel.addMilestone({
      promiseId: 'p_no_prog',
      stage: 'progression',
      quote: 'Found clue',
      paragraph_index: 3,
    });
    expect(noProg.progressions).toHaveLength(1);
  });

  it('removes milestone for progression and resolution', async () => {
    const ms1 = { id: 'ms_1', chapter_id: 'ch_1', paragraph_index: 1, quote: 'q1' };
    const p = {
      id: 'p1',
      chapter_id: 'ch_1',
      status: 'developed',
      progressions: [ms1],
      resolution: { id: 'res_1', quote: 'done' },
    };
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce([p] as any);
    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    // Remove progression milestone (resets developed -> planted when empty)
    await panel.removeMilestone(p as any, 'ms_1', 'progression');
    expect(p.progressions).toHaveLength(0);
    expect(p.status).toBe('planted');

    // Remove resolution milestone (resets to developed if progressions, or planted if none)
    p.status = 'resolved';
    await panel.removeMilestone(p as any, 'res_1', 'resolution');
    expect(p.resolution).toBeNull();
    expect(p.status).toBe('planted');
  });

  it('updates promise status', async () => {
    const p = { id: 'p1', status: 'planted', resolved_in_chapter: null };
    const panel = usePromisesPanel(props, emit);

    // Early return if same status or empty id
    await panel.updateStatus({ id: '' } as any, 'planted');
    await panel.updateStatus(p as any, 'planted');
    expect(api.savePlotPromise).not.toHaveBeenCalled();

    // Update to resolved
    await panel.updateStatus(p as any, 'resolved');
    expect(p.status).toBe('resolved');
    expect(p.resolved_in_chapter).toBe('ch_1');
    expect(api.savePlotPromise).toHaveBeenCalled();
  });

  it('handles note editing: start, save, and cancel', async () => {
    const p = { id: 'p1', note: 'Old note' };
    const panel = usePromisesPanel(props, emit);

    panel.startEditNote(p as any);
    expect(panel.editingNoteId.value).toBe('p1');
    expect(panel.noteDraft.value).toBe('Old note');

    panel.noteDraft.value = '   ';
    await panel.saveNote(p as any);
    expect(p.note).toBeNull();
    expect(panel.editingNoteId.value).toBeNull();

    panel.startEditNote(p as any);
    panel.cancelEditNote();
    expect(panel.editingNoteId.value).toBeNull();
    expect(panel.noteDraft.value).toBe('');
  });

  it('removes promise and handles errors', async () => {
    const p = { id: 'p1' };
    vi.mocked(api.getPlotPromises).mockResolvedValueOnce([p] as any);
    const panel = usePromisesPanel(props, emit);
    await panel.loadPromises();

    await panel.removePromise({ id: '' } as any);
    expect(panel.promises.value).toHaveLength(1);

    vi.mocked(api.deletePlotPromise).mockResolvedValueOnce();
    await panel.removePromise(p as any);
    expect(panel.promises.value).toHaveLength(0);
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('locates source and returns kind info with fallbacks', () => {
    const panel = usePromisesPanel(props, emit);

    panel.locateSource({ chapter_id: 'ch_1', paragraph_index: 3, quote: 'Quote text' });
    expect(emit).toHaveBeenCalledWith('locate', {
      chapterId: 'ch_1',
      paragraphIndex: 3,
      quote: 'Quote text',
      blockId: undefined,
    });

    expect(panel.getKindInfo('gun').label).toBe('Чеховское ружьё');
    expect(panel.getKindInfo('custom_kind')).toEqual({ label: 'custom_kind', icon: '📌' });
  });

  it('handles cleanId with various object shapes', () => {
    const panel = usePromisesPanel(props, emit);
    expect(panel.isCurrentChapterPromise('ch_1')).toBe(true);
    expect(panel.isCurrentChapterPromise('chapters:ch_1')).toBe(true);
    expect(panel.isCurrentChapterPromise('ch_2')).toBe(false);
  });

  it('resizes promisesHeight on mousemove and saves to localStorage on mouseup', () => {
    localStorage.clear();
    const panel = usePromisesPanel(props, emit);
    expect(panel.promisesHeight.value).toBe(260);

    const mousedownEv = new MouseEvent('mousedown', { clientY: 100 });
    panel.startVerticalResize(mousedownEv);
    expect(panel.isResizing.value).toBe(true);

    const mousemoveEv = new MouseEvent('mousemove', { clientY: 180 });
    document.dispatchEvent(mousemoveEv);

    const mouseupEv = new MouseEvent('mouseup');
    document.dispatchEvent(mouseupEv);

    expect(panel.isResizing.value).toBe(false);
    expect(panel.promisesHeight.value).toBe(340);
    expect(localStorage.getItem('chapters-panel-promises-h')).toBe('340');
  });
});
