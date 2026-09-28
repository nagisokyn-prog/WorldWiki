import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useArcBoard } from './useArcBoard';
import * as apiClient from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getStoryArcs: vi.fn(),
  saveStoryArc: vi.fn(),
  deleteStoryArc: vi.fn(),
  assignArcChapter: vi.fn(),
  removeArcChapter: vi.fn(),
  assignArcEntity: vi.fn(),
  removeArcEntity: vi.fn(),
  getArcChapters: vi.fn(),
  getArcEntities: vi.fn(),
  getPlotPromises: vi.fn().mockResolvedValue([]),
}));

describe('useStoryArcs Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('groups arcs into Kanban columns by status', async () => {
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка 1', arc_type: 'character', status: 'planned' },
      { id: 'arc:2', project_id: 'test_proj', title: 'Арка 2', arc_type: 'event', status: 'in_progress' },
      { id: 'arc:3', project_id: 'test_proj', title: 'Арка 3', arc_type: 'theme', status: 'completed' },
    ]);

    const { columns, refresh } = useArcBoard('test_proj');
    await refresh();

    expect(columns.value).toHaveLength(4);

    const plannedCol = columns.value.find(c => c.status === 'planned');
    expect(plannedCol?.arcs).toHaveLength(1);
    expect(plannedCol?.arcs[0].title).toBe('Арка 1');

    const inProgressCol = columns.value.find(c => c.status === 'in_progress');
    expect(inProgressCol?.arcs).toHaveLength(1);
    expect(inProgressCol?.arcs[0].title).toBe('Арка 2');

    const completedCol = columns.value.find(c => c.status === 'completed');
    expect(completedCol?.arcs).toHaveLength(1);
    expect(completedCol?.arcs[0].title).toBe('Арка 3');
  });

  it('automatically calculates arc status from linked plot promises', async () => {
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка с блоком', arc_type: 'character', status: 'planned' },
      { id: 'arc:2', project_id: 'test_proj', title: 'Завершённая арка', arc_type: 'event', status: 'planned' },
    ]);
    vi.mocked(apiClient.getPlotPromises).mockResolvedValueOnce([
      {
        id: 'p1',
        project_id: 'test_proj',
        chapter_id: 'ch1',
        kind: 'scene',
        quote: 'Начало арки',
        paragraph_index: 1,
        block_id: 'b1',
        note: null,
        status: 'planted',
        progressions: [],
        resolution: null,
        resolved_in_volume: null,
        resolved_in_chapter: null,
        participant_ids: null,
        location_id: null,
        timeline_event_id: null,
        arc_id: 'arc:1',
        arc_phase: 'setup'
      },
      {
        id: 'p2',
        project_id: 'test_proj',
        chapter_id: 'ch2',
        kind: 'scene',
        quote: 'Конец арки',
        paragraph_index: 5,
        block_id: 'b2',
        note: null,
        status: 'resolved',
        progressions: [],
        resolution: {},
        resolved_in_volume: null,
        resolved_in_chapter: null,
        participant_ids: null,
        location_id: null,
        timeline_event_id: null,
        arc_id: 'arc:2',
        arc_phase: 'resolution'
      }
    ] as any);

    const { columns, getLinkedBlocks, refresh } = useArcBoard('test_proj');
    await refresh();

    const inProgressCol = columns.value.find(c => c.status === 'in_progress');
    expect(inProgressCol?.arcs.some(a => a.id === 'arc:1')).toBe(true);

    const completedCol = columns.value.find(c => c.status === 'completed');
    expect(completedCol?.arcs.some(a => a.id === 'arc:2')).toBe(true);

    const linked = getLinkedBlocks('arc:1');
    expect(linked).toHaveLength(1);
    expect(linked[0].quote).toBe('Начало арки');
  });

  it('handles a single scene block bound to multiple arcs simultaneously', async () => {
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка А (Начало)', arc_type: 'character', status: 'planned' },
      { id: 'arc:2', project_id: 'test_proj', title: 'Арка Б (Финал)', arc_type: 'event', status: 'planned' },
    ]);
    vi.mocked(apiClient.getPlotPromises).mockResolvedValueOnce([
      {
        id: 'p_multi',
        project_id: 'test_proj',
        chapter_id: 'ch1',
        kind: 'scene',
        quote: 'Кульминационная сцена битвы',
        paragraph_index: 3,
        block_id: 'b_multi',
        note: null,
        status: 'resolved',
        progressions: [],
        resolution: { note: 'Победа' },
        resolved_in_volume: null,
        resolved_in_chapter: null,
        participant_ids: null,
        location_id: null,
        timeline_event_id: null,
        arcs: [
          { arc_id: 'arc:1', arc_phase: 'setup' },
          { arc_id: 'arc:2', arc_phase: 'resolution' }
        ]
      }
    ] as any);

    const { columns, getLinkedBlocks, refresh } = useArcBoard('test_proj');
    await refresh();

    // Arc 1 has phase setup -> in_progress
    const inProgressCol = columns.value.find(c => c.status === 'in_progress');
    expect(inProgressCol?.arcs.some(a => a.id === 'arc:1')).toBe(true);

    // Arc 2 has phase resolution and status resolved -> completed
    const completedCol = columns.value.find(c => c.status === 'completed');
    expect(completedCol?.arcs.some(a => a.id === 'arc:2')).toBe(true);

    // Both arcs link to this scene block
    expect(getLinkedBlocks('arc:1')).toHaveLength(1);
    expect(getLinkedBlocks('arc:2')).toHaveLength(1);
  });

  it('useArcCard computes phase counts correctly for the 4-phase stepper', async () => {
    const { useArcCard } = await import('./components/useArcCard');
    const arc = { id: 'arc:main', project_id: 'test_proj', title: 'Главная арка', arc_type: 'character', status: 'in_progress' } as any;
    const linkedBlocks = [
      { id: 'b1', chapter_id: 'chapters:1', paragraph_index: 2, arc_phase: 'setup', quote: 'Завязка' },
      { id: 'b2', chapter_id: 'chapters:2', paragraph_index: 10, arc_phase: 'escalation', quote: 'Эскалация 1' },
      { id: 'b3', chapter_id: 'chapters:3', paragraph_index: 4, arc_phase: 'escalation', quote: 'Эскалация 2' },
      { id: 'b4', chapter_id: 'chapters:4', paragraph_index: 1, arc_phase: 'climax', quote: 'Кульминация' },
    ] as any;

    const { phaseCounts, getPhaseInfo, formatChapterName, getArcTypeLabel } = useArcCard({
      arc,
      effectiveStatus: 'in_progress',
      linkedBlocks,
    });

    expect(phaseCounts.value.setup).toBe(1);
    expect(phaseCounts.value.escalation).toBe(2);
    expect(phaseCounts.value.climax).toBe(1);
    expect(phaseCounts.value.resolution).toBe(0);

    expect(getPhaseInfo(linkedBlocks[0], 'arc:main').label).toBe('🌱 Завязка');
    expect(getPhaseInfo(linkedBlocks[3], 'arc:main').label).toBe('🔥 Кульминация');
    expect(formatChapterName('chapters:ch_12')).toBe('Гл. ch_12');
    expect(getArcTypeLabel('character')).toBe('Персонаж');
  });
});

