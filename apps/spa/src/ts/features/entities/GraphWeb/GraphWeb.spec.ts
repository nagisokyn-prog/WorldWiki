import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphWebView } from './useGraphWebView';
import * as apiClient from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getGraphTimeSlice: vi.fn(),
}));

describe('useGraphWeb Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters edges and nodes based on chapter time slice', async () => {
    vi.mocked(apiClient.getGraphTimeSlice).mockResolvedValueOnce({
      nodes: [
        { id: 'ent:1', name: 'Рудеус', entity_type: 'character' },
        { id: 'ent:2', name: 'Эрис', entity_type: 'character' },
        { id: 'ent:3', name: 'Паулс', entity_type: 'character' },
      ],
      edges: [
        {
          id: 'rel:1',
          source_id: 'ent:1',
          target_id: 'ent:2',
          rel_type: 'дружба',
          strength: 80,
          start_order: 1,
          end_order: 5,
        },
        {
          id: 'rel:2',
          source_id: 'ent:1',
          target_id: 'ent:3',
          rel_type: 'отец',
          strength: 40,
          start_order: 6,
          end_order: 10,
        },
      ],
    });

    const { filteredEdges, filteredNodes, filters, refresh } = useGraphWebView('test_proj');
    await refresh();

    expect(filteredNodes.value).toHaveLength(3);

    // Chapter 3 -> rel:1 is active (1..5), rel:2 is inactive (6..10)
    filters.value.selectedChapterOrder = 3;
    expect(filteredEdges.value).toHaveLength(1);
    expect(filteredEdges.value[0].id).toBe('rel:1');

    // Chapter 8 -> rel:1 is inactive, rel:2 is active
    filters.value.selectedChapterOrder = 8;
    expect(filteredEdges.value).toHaveLength(1);
    expect(filteredEdges.value[0].id).toBe('rel:2');
  });
});
