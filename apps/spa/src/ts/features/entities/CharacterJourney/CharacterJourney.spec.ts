import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCharacterJourney } from './useCharacterJourney';
import * as apiClient from '@/services/api.client';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api.client', () => ({
  getCharacterJourney: vi.fn(),
  getEntities: vi.fn(),
  getStoryArcs: vi.fn(),
}));

describe('useCharacterJourney Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('aggregates appearances, events, relations, and promises into chronological stream and arc groups', async () => {
    vi.mocked(apiClient.getEntities).mockResolvedValueOnce([
      { id: 'ent:1', name: 'Сонечка', entity_type: 'character', project_id: 'test_proj', attributes: {}, tags: [] },
    ]);
    vi.mocked(apiClient.getStoryArcs).mockResolvedValueOnce([
      { id: 'arc:1', project_id: 'test_proj', title: 'Арка Искупления', description: null, arc_type: 'main', status: 'active', color: 'var(--color-accent)' },
    ]);
    vi.mocked(apiClient.getCharacterJourney).mockResolvedValueOnce({
      entity_id: 'ent:1',
      entity_name: 'Сонечка',
      entity_type: 'character',
      appearances: [
        { chapter_id: 'ch:1', chapter_title: 'Глава 1: Знакомство', chapter_order: 1, source: 'scene' },
        { chapter_id: 'ch:5', chapter_title: 'Глава 5: Исповедь', chapter_order: 5, source: 'scene' },
      ],
      events: [
        { event_id: 'ev:1', event_title: 'Трагедия на Сенной', m_abs: 1200, role: 'Свидетель' },
        { event_id: 'ev:2', event_title: 'Флэшбек: Воспоминание детства', m_abs: 100, role: 'Участник' },
      ],
      relations: [
        { id: 'rel:1', target_name: 'Раскольников', rel_type: 'сострадание', strength: 90, start_order: 1 },
      ],
      promises: [
        {
          id: 'prom:1',
          kind: 'scene',
          quote: 'Чтение Евангелия',
          status: 'planted',
          planted_order: 4,
          arc_id: 'arc:1',
          arc_title: 'Арка Искупления',
          arc_phase: 'climax',
        },
      ],
    });

    const { timelineItems, arcGroups, viewMode, filterType, refresh } = useCharacterJourney('test_proj', 'ent:1');
    await refresh();

    // 1. Total items check
    expect(timelineItems.value.length).toBe(6);

    // 2. Arc Grouping check
    expect(arcGroups.value.length).toBeGreaterThan(0);
    const redemptionArc = arcGroups.value.find((g) => g.arcId === 'arc:1');
    expect(redemptionArc).toBeDefined();
    expect(redemptionArc?.items.some((i) => i.id === 'prom-prom:1')).toBe(true);

    // 3. Filter by promises
    filterType.value = 'promises';
    expect(timelineItems.value.length).toBe(1);
    expect(timelineItems.value[0].type).toBe('promise');
    expect(timelineItems.value[0].arc_title).toBe('Арка Искупления');

    // 4. Reset filter and switch to Chronology mode
    filterType.value = 'all';
    viewMode.value = 'CHRONOLOGY';
    expect(timelineItems.value.length).toBe(6);
    // In chronology mode, ev:2 (m_abs=100) should come before ev:1 (m_abs=1200)
    const eventItems = timelineItems.value.filter((i) => i.type === 'event');
    expect(eventItems[0].m_abs).toBe(100);
    expect(eventItems[1].m_abs).toBe(1200);
  });
});
