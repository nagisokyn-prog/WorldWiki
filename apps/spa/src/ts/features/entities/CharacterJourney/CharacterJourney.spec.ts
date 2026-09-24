import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCharacterJourney } from './useCharacterJourney';
import * as apiClient from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getCharacterJourney: vi.fn(),
}));

describe('useCharacterJourney Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates appearances, events, relations, and promises into chronological stream', async () => {
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
      entity: { id: 'ent:1', name: 'Рудеус', entity_type: 'character' },
      appearances: [
        { chapter_id: 'ch:1', chapter_title: 'Глава 1: Пробуждение', chapter_order: 1, source: 'scene' },
        { chapter_id: 'ch:5', chapter_title: 'Глава 5: Конфликт', chapter_order: 5, source: 'scene' },
      ],
      events: [
        { event_id: 'ev:1', event_title: 'Телепортационный катаклизм', m_abs: 3400, role: 'Жертва' },
      ],
      relations: [
        { id: 'rel:1', target_name: 'Эрис', rel_type: 'дружба', strength: 50, start_order: 2 },
      ],
      promises: [
        { id: 'prom:1', kind: 'gun', quote: 'Странный посох магии', status: 'planted', planted_order: 1 },
      ],
    });

    const { timelineItems, filterType, refresh } = useCharacterJourney('test_proj', 'ent:1');
    await refresh();

    expect(timelineItems.value.length).toBe(5);

    // Filter by appearances
    filterType.value = 'appearances';
    expect(timelineItems.value.length).toBe(2);
    expect(timelineItems.value[0].type).toBe('appearance');
    expect(timelineItems.value[0].title).toContain('Глава 1');

    // Filter by promises
    filterType.value = 'promises';
    expect(timelineItems.value.length).toBe(1);
    expect(timelineItems.value[0].type).toBe('promise');
  });
});
