import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTimelineInspector } from './useTimelineInspector';
import * as apiClient from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getTimelineInspectorData: vi.fn(),
}));

describe('useTimelineInspector Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('calculates dual-axis connection lines and detects flashbacks', async () => {
    vi.mocked(apiClient.getTimelineInspectorData).mockResolvedValueOnce({
      chapters: [
        { id: 'ch:1', title: 'Глава 1', sort_order: 1 },
        { id: 'ch:2', title: 'Глава 2', sort_order: 2 },
        { id: 'ch:3', title: 'Глава 3', sort_order: 3 },
      ],
      events: [
        {
          id: 'ev:past',
          title: 'Древнее событие',
          m_abs: 100,
          reveals: [
            { chapter_id: 'ch:3', chapter_title: 'Глава 3', chapter_order: 3, kind: 'flashback' },
          ],
          participants: [{ id: 'ent:1', name: 'Герой', entity_type: 'character' }],
        },
        {
          id: 'ev:present',
          title: 'Текущая битва',
          m_abs: 500,
          reveals: [
            { chapter_id: 'ch:1', chapter_title: 'Глава 1', chapter_order: 1, kind: 'direct' },
          ],
          participants: [],
        },
      ],
    });

    const { filteredChapters, filteredEvents, connectionLines, refresh } = useTimelineInspector('test_proj');
    await refresh();

    expect(filteredChapters.value).toHaveLength(3);
    expect(filteredEvents.value).toHaveLength(2);
    expect(connectionLines.value).toHaveLength(2);

    const flashbackLine = connectionLines.value.find(l => l.eventId === 'ev:past');
    expect(flashbackLine).toBeDefined();
    expect(flashbackLine?.isFlashback).toBe(true);
  });
});
