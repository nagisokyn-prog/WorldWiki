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

  it('maps event kinds correctly and provides navigation handlers', async () => {
    vi.mocked(apiClient.getTimelineInspectorData).mockResolvedValueOnce({
      chapters: [
        { id: 'chapters:ch_1', title: 'Глава 1', sort_order: 1 },
      ],
      events: [
        {
          id: 'plot_promises:conf_1',
          title: 'Дуэль на мосту',
          m_abs: 200,
          kind: 'conflict',
          location_id: 'locations:bridge',
          reveals: [
            { chapter_id: 'chapters:ch_1', chapter_title: 'Глава 1', chapter_order: 1, kind: 'direct', block_id: 'b_1' },
          ],
          participants: [{ id: 'ent:1', name: 'Рыцарь', entity_type: 'character' }],
        },
      ],
    });

    const emit = vi.fn();
    const { formattedEvents, navigateToScene, navigateToChapter, refresh } = useTimelineInspector(
      { projectId: 'test_proj' },
      emit
    );
    await refresh();

    expect(formattedEvents.value).toHaveLength(1);
    const ev = formattedEvents.value[0];
    expect(ev.kind).toBe('conflict');
    expect(ev.kindMeta.label).toBe('Конфликт');
    expect(ev.kindMeta.icon).toBe('⚔️');
    expect(ev.title).toBe('Дуэль на мосту');
    expect(ev.location_id).toBe('locations:bridge');

    // Navigation tests
    navigateToChapter({ id: 'chapters:ch_1', title: 'Глава 1', sort_order: 1 });
    expect(emit).toHaveBeenCalledWith('open-chapter', { id: 'ch_1', title: 'Глава 1' });

    navigateToScene(ev);
    expect(emit).toHaveBeenCalledWith('open-chapter', { id: 'ch_1', title: 'Глава 1' });
  });
});
