import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStoryArcsStore } from '../story_arcs.store';

const mockGetStoryArcs = vi.fn();
const mockSaveStoryArc = vi.fn();
const mockDeleteStoryArc = vi.fn();
const mockAssignArcChapter = vi.fn();
const mockRemoveArcChapter = vi.fn();
const mockAssignArcEntity = vi.fn();
const mockRemoveArcEntity = vi.fn();
const mockGetArcChapters = vi.fn();
const mockGetArcEntities = vi.fn();
const mockGetArcsForChapter = vi.fn();

vi.mock('@/services/api.client', () => ({
  getStoryArcs: (...args: unknown[]) => mockGetStoryArcs(...args),
  saveStoryArc: (...args: unknown[]) => mockSaveStoryArc(...args),
  deleteStoryArc: (...args: unknown[]) => mockDeleteStoryArc(...args),
  assignArcChapter: (...args: unknown[]) => mockAssignArcChapter(...args),
  removeArcChapter: (...args: unknown[]) => mockRemoveArcChapter(...args),
  assignArcEntity: (...args: unknown[]) => mockAssignArcEntity(...args),
  removeArcEntity: (...args: unknown[]) => mockRemoveArcEntity(...args),
  getArcChapters: (...args: unknown[]) => mockGetArcChapters(...args),
  getArcEntities: (...args: unknown[]) => mockGetArcEntities(...args),
  getArcsForChapter: (...args: unknown[]) => mockGetArcsForChapter(...args)
}));

describe('story_arcs.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads arcs, normalizes fields, uses cache unless force=true, and handles errors', async () => {
    const store = useStoryArcsStore();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockGetStoryArcs.mockResolvedValueOnce([
      { id: 'arc:1', title: 'Главная', arc_type: 'main', status: 'in_progress' },
      { title: 'Без полей', arc_type: 'sub', status: 'planned' }
    ]);

    const first = await store.loadArcs('proj-1');
    expect(first).toHaveLength(2);
    expect(first[1]).toMatchObject({ id: null, project_id: null, description: null, color: null });
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();

    // Cache hit for same project
    const cached = await store.loadArcs('proj-1');
    expect(cached).toHaveLength(2);
    expect(mockGetStoryArcs).toHaveBeenCalledTimes(1);

    // Force reload with non-array response
    mockGetStoryArcs.mockResolvedValueOnce(null);
    const forced = await store.loadArcs('proj-1', true);
    expect(forced).toEqual([]);
    expect(mockGetStoryArcs).toHaveBeenCalledTimes(2);

    // Error handling with Error and non-Error
    mockGetStoryArcs.mockRejectedValueOnce(new Error('DB down'));
    const onErr = await store.loadArcs('proj-2');
    expect(onErr).toEqual([]);
    expect(store.error).toBe('DB down');

    mockGetStoryArcs.mockRejectedValueOnce('raw-err');
    await store.loadArcs('proj-3');
    expect(store.error).toBe('raw-err');

    errSpy.mockRestore();
  });

  it('saves new and existing arcs, and handles save errors', async () => {
    const store = useStoryArcsStore();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.currentProject = 'proj-1';

    mockSaveStoryArc.mockResolvedValueOnce('arc:new');
    const created = await store.saveArc({ title: 'Новая арка' });
    expect(created).toMatchObject({
      id: 'arc:new',
      project_id: 'proj-1',
      title: 'Новая арка',
      arc_type: 'event',
      status: 'in_progress'
    });
    expect(store.arcs).toHaveLength(1);

    // Update existing arc (fallback id from input when saveStoryArc returns empty)
    mockSaveStoryArc.mockResolvedValueOnce('');
    const updated = await store.saveArc({
      id: 'arc:new',
      project_id: 'proj-2',
      title: 'Обновлённая',
      description: 'Описание',
      arc_type: 'character',
      status: 'resolved',
      color: '#ff0'
    });
    expect(updated).toMatchObject({ id: 'arc:new', title: 'Обновлённая', color: '#ff0' });
    expect(store.arcs).toHaveLength(1);

    mockSaveStoryArc.mockRejectedValueOnce(new Error('save fail'));
    expect(await store.saveArc({ title: 'Broken' })).toBeNull();

    errSpy.mockRestore();
  });

  it('removes arc and clears cached bindings, or returns false on error', async () => {
    const store = useStoryArcsStore();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    store.arcs = [{ id: 'arc:1', project_id: 'p', title: 'A', description: null, arc_type: 'event', status: 'open', color: null }];
    store.arcChapters.set('arc:1', [{ chapter_id: 'ch:1' }]);
    store.arcEntities.set('arc:1', [{ entity_id: 'e:1' }]);

    mockDeleteStoryArc.mockResolvedValueOnce(undefined);
    expect(await store.removeArc('arc:1')).toBe(true);
    expect(store.arcs).toEqual([]);
    expect(store.arcChapters.has('arc:1')).toBe(false);
    expect(store.arcEntities.has('arc:1')).toBe(false);

    mockDeleteStoryArc.mockRejectedValueOnce(new Error('del fail'));
    expect(await store.removeArc('arc:2')).toBe(false);

    errSpy.mockRestore();
  });

  it('loads bindings with per-call fallbacks, binds/unbinds chapters and entities, and loads arcs for chapter', async () => {
    const store = useStoryArcsStore();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGetArcChapters.mockResolvedValueOnce([{ arc_id: 'arc:1', chapter_id: 'ch:1' }]);
    mockGetArcEntities.mockRejectedValueOnce(new Error('entities fail'));
    await store.loadBindings('arc:1');
    expect(store.arcChapters.get('arc:1')).toHaveLength(1);
    expect(store.arcEntities.get('arc:1')).toEqual([]);

    mockGetArcChapters.mockRejectedValueOnce(new Error('chapters fail'));
    mockGetArcEntities.mockResolvedValueOnce('not-array');
    await store.loadBindings('arc:2');
    expect(store.arcChapters.get('arc:2')).toEqual([]);
    expect(store.arcEntities.get('arc:2')).toEqual([]);

    mockAssignArcChapter.mockResolvedValue(undefined);
    await store.bindChapter({ arc_id: 'arc:1', chapter_id: 'ch:2', sort_order: 2, phase: 'climax' });
    await store.bindChapter({}); // no inKey branch
    expect(store.arcChapters.get('arc:1')).toHaveLength(2);

    mockRemoveArcChapter.mockResolvedValue(undefined);
    await store.unbindChapter('arc:1', 'ch:2');
    expect(store.arcChapters.get('arc:1')).toHaveLength(1);
    await store.unbindChapter('arc:missing', 'ch:1');
    expect(store.arcChapters.get('arc:missing')).toEqual([]);

    mockAssignArcEntity.mockResolvedValue(undefined);
    await store.bindEntity({ in: 'arc:1', out: 'ent:1' });
    await store.bindEntity({}); // no inKey branch
    expect(store.arcEntities.get('arc:1')).toHaveLength(1);

    mockRemoveArcEntity.mockResolvedValue(undefined);
    await store.unbindEntity('arc:1', 'ent:1');
    expect(store.arcEntities.get('arc:1')).toEqual([]);

    mockGetArcsForChapter.mockResolvedValueOnce([{ id: 'arc:1' }]);
    expect(await store.loadArcsForChapter('ch:1')).toEqual([{ id: 'arc:1' }]);

    mockGetArcsForChapter.mockRejectedValueOnce(new Error('chapter arcs fail'));
    expect(await store.loadArcsForChapter('ch:1')).toEqual([]);

    warnSpy.mockRestore();
  });
});
