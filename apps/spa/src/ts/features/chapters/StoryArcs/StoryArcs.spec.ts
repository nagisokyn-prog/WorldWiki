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

    const { columns } = useArcBoard('test_proj');

    // Wait for the async load
    await new Promise(resolve => setTimeout(resolve, 0));

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

  it('creates and updates arc status', async () => {
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([]);
    vi.mocked(apiClient.saveStoryArc).mockImplementation(async (arc) => ({
      ...(arc as Record<string, unknown>),
      id: 'arc:new',
    }));

    const { createNewArc, updateArcStatus, columns } = useArcBoard('test_proj');

    await createNewArc('Новая Арка', 'event');

    const plannedCol = columns.value.find(c => c.status === 'planned');
    expect(plannedCol?.arcs).toHaveLength(1);

    await updateArcStatus(plannedCol!.arcs[0], 'in_progress');

    const inProgressCol = columns.value.find(c => c.status === 'in_progress');
    expect(inProgressCol?.arcs).toHaveLength(1);
  });
});
