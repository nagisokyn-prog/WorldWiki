import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useArcBoard } from './useArcBoard';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { plotApi } from '@/services/api/plot.api';

vi.mock('@/services/api/plot.api', () => ({
  plotApi: {
    getPlotPromises: vi.fn(async () => []),
  },
}));

describe('useArcBoard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads promises, computes effective arc status, filters, and sorts arc promises', async () => {
    const store = useStoryArcsStore();
    store.loadArcs = vi.fn(async () => undefined) as any;
    store.arcs = [
      { id: 'story_arcs:a1', title: 'Арка Битвы', arc_type: 'plot', status: 'in_progress' } as any,
      { id: '', title: 'Без ID', arc_type: 'character', status: '' } as any,
    ];

    vi.mocked(plotApi.getPlotPromises).mockResolvedValue([
      {
        id: 'p1',
        chapter_id: 'chapters:2',
        paragraph_index: 5,
        status: 'resolved',
        arcs: [{ arc_id: 'story_arcs:a1', arc_phase: 'resolution' }],
      },
      {
        id: 'p2',
        chapter_id: 'chapters:1',
        paragraph_index: 1,
        status: 'planted',
        arc_id: 'story_arcs:a1',
        arc_phase: 'setup',
      },
    ] as any);

    const board = useArcBoard('');
    await board.refresh();
    expect(plotApi.getPlotPromises).not.toHaveBeenCalled();

    const activeBoard = useArcBoard('proj_1');
    await activeBoard.refresh();

    // Resolved resolution promise -> effective status 'completed'
    expect(activeBoard.getArcEffectiveStatus(store.arcs[0])).toBe('completed');
    expect(activeBoard.getArcEffectiveStatus(store.arcs[1])).toBe('planned');

    const arcPromises = activeBoard.getLinkedBlocks('a1');
    expect(arcPromises.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(activeBoard.getLinkedBlocks('')).toEqual([]);

    // Filters
    activeBoard.filters.value.selectedType = 'plot';
    activeBoard.filters.value.searchQuery = 'битвы';
    expect(activeBoard.columns.value.find((c) => c.status === 'completed')?.arcs).toHaveLength(1);
    activeBoard.filters.value.searchQuery = 'нет';
    expect(activeBoard.columns.value.every((c) => c.arcs.length === 0)).toBe(true);
  });
});
