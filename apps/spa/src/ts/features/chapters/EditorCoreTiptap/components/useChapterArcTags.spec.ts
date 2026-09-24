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
  getArcEntities: vi.fn()
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
      { in: 'arc_1', out: 'chapters:ch_1', project_id: 'test_proj' }
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
});
