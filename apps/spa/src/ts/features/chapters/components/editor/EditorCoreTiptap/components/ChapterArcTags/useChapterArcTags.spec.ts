import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChapterArcTags } from './useChapterArcTags';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api.client', () => ({
  getStoryArcs: vi.fn(),
  saveStoryArc: vi.fn(),
  deleteStoryArc: vi.fn(),
  assignArcChapter: vi.fn(),
  removeArcChapter: vi.fn(),
  getArcChapters: vi.fn(),
  getArcEntities: vi.fn(),
  getArcsForChapter: vi.fn()
}));

describe('useChapterArcTags', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('computes bound and available arcs correctly', async () => {
    const store = useStoryArcsStore();
    store.arcs = [
      { id: 'arc_1', title: 'Арка Войны', arc_type: 'event', status: 'in_progress' },

      { id: 'arc_2', title: 'Арка Мира', arc_type: 'theme', status: 'planned' }
    ];

    store.arcChapters.set('arc_1', [
      { arc_id: 'arc_1', chapter_id: 'chapters:ch_1', project_id: 'test_proj' }
    ]);

    const { boundArcs, availableArcs } = useChapterArcTags({
      project: 'test_proj',
      chapterId: 'ch_1'
    });

    expect(boundArcs.value).toHaveLength(1);
    expect(boundArcs.value[0].arcId).toBe('arc_1');
    expect(boundArcs.value[0].title).toBe('Арка Войны');

    expect(availableArcs.value).toHaveLength(1);
    expect(availableArcs.value[0].id).toBe('arc_2');
  });

  it('computes bound arcs when relations use out property (legacy)', async () => {
    const store = useStoryArcsStore();
    store.arcs = [
      { id: 'arc_1', title: 'Арка Войны', arc_type: 'event', status: 'in_progress' }
    ];

    store.arcChapters.set('arc_1', [
      { in: 'arc_1', out: 'chapters:ch_1', project_id: 'test_proj' }
    ]);

    const { boundArcs } = useChapterArcTags({
      project: 'test_proj',
      chapterId: 'ch_1'
    });

    expect(boundArcs.value).toHaveLength(1);
    expect(boundArcs.value[0].arcId).toBe('arc_1');
  });

  it('binds and unbinds arcs', async () => {
    const store = useStoryArcsStore();
    store.arcs = [
      { id: 'arc_1', title: 'Арка Войны', arc_type: 'event', status: 'in_progress' }
    ];


    const changeSpy = vi.fn();
    const { attachArc, detachArc } = useChapterArcTags(
      { project: 'test_proj', chapterId: 'ch_1' },
      changeSpy
    );

    const bindSpy = vi.spyOn(store, 'bindChapter').mockResolvedValue();
    const unbindSpy = vi.spyOn(store, 'unbindChapter').mockResolvedValue();

    await attachArc('arc_1');
    expect(bindSpy).toHaveBeenCalledWith({
      in: 'arc_1',
      out: 'chapters:ch_1',
      project_id: 'test_proj'
    });
    expect(changeSpy).toHaveBeenCalled();

    await detachArc('arc_1');
    expect(unbindSpy).toHaveBeenCalledWith('arc_1', 'chapters:ch_1');
  });

  it('loads arcs and bindings, and creates+attaches a new arc', async () => {
    const store = useStoryArcsStore();
    const loadArcsSpy = vi.spyOn(store, 'loadArcs').mockImplementation(async () => {
      store.arcs = [{ id: 'arc_1', title: 'A1', arc_type: 'event', status: 'in_progress' }];
    });
    const loadBindingsSpy = vi.spyOn(store, 'loadBindings').mockResolvedValue();
    const saveArcSpy = vi.spyOn(store, 'saveArc').mockResolvedValue({
      id: 'arc_new',
      title: 'Новая',
      arc_type: 'event',
      status: 'in_progress',
    });
    const bindSpy = vi.spyOn(store, 'bindChapter').mockResolvedValue();

    const changeSpy = vi.fn();
    const tags = useChapterArcTags({ project: 'test_proj', chapterId: 'ch_1' }, changeSpy);
    await Promise.resolve();
    await Promise.resolve();

    expect(loadArcsSpy).toHaveBeenCalledWith('test_proj');
    expect(loadBindingsSpy).toHaveBeenCalledWith('arc_1');

    // Empty title guard
    tags.newArcTitle.value = '   ';
    await tags.createAndAttachArc();
    expect(saveArcSpy).not.toHaveBeenCalled();

    tags.newArcTitle.value = 'Новая арка';
    await tags.createAndAttachArc();
    expect(saveArcSpy).toHaveBeenCalled();
    expect(bindSpy).toHaveBeenCalledWith({
      in: 'arc_new',
      out: 'chapters:ch_1',
      project_id: 'test_proj',
    });
    expect(tags.newArcTitle.value).toBe('');
    expect(tags.isCreating.value).toBe(false);
  });

  it('guards against missing project/chapterId and handles empty relation outCandidate', async () => {
    const store = useStoryArcsStore();
    store.arcs = [{ id: 'arc_1', title: 'A1', arc_type: 'event', status: 'in_progress' }];
    store.arcChapters.set('arc_1', [{ arc_id: 'arc_1', project_id: 'p' }]);

    const empty = useChapterArcTags({ project: '', chapterId: '' });
    expect(empty.boundArcs.value).toEqual([]);
    await empty.attachArc('arc_1');
    await empty.detachArc('arc_1');
    empty.newArcTitle.value = 'Valid';
    await empty.createAndAttachArc();

    const noOut = useChapterArcTags({ project: 'p1', chapterId: 'chapters:c1' });
    expect(noOut.boundArcs.value).toEqual([]);
  });
});
