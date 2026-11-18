import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPromiseCardEntities } from './usePromiseCardEntitiesLoader';
import * as api from '@/services/api.client';
import type { useCalendarStore } from '@/stores/calendar.store';
import type { useStoryArcsStore } from '@/stores/story_arcs.store';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn(),
  getGlobalTimeline: vi.fn(),
}));

describe('usePromiseCardEntitiesLoader', () => {
  const calendarStore = {
    getCalendars: vi.fn().mockResolvedValue([{ id: 'cal:1', name: 'Main' }]),
  } as unknown as ReturnType<typeof useCalendarStore>;

  const arcsStore = {
    loadArcs: vi.fn().mockResolvedValue([]),
  } as unknown as ReturnType<typeof useStoryArcsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates locations, places, characters, and array-shaped global timeline', async () => {
    vi.mocked(api.getEntities)
      .mockResolvedValueOnce([{ id: 'loc:1', name: 'Таверна' }, { id: 'loc:1', name: 'Dup' }] as never)
      .mockResolvedValueOnce([{ id: 'place:1', title: 'Площадь' }] as never)
      .mockResolvedValueOnce([{ id: 'char:1', name: 'Герой' }] as never);

    vi.mocked(api.getGlobalTimeline).mockResolvedValueOnce([
      {
        id: 'chapters:1',
        title: 'Глава 1',
        timeline_events: [{ id: 'ev:1', title: 'Встреча', m_abs: 100 }],
      },
    ]);

    const res = await fetchPromiseCardEntities('proj-1', calendarStore, arcsStore);
    expect(res.locations).toHaveLength(2);
    expect(res.characters).toEqual([{ id: 'char:1', name: 'Герой', type: 'character' }]);
    expect(res.timelineEvents).toEqual([{ id: 'ev:1', title: '[Глава 1] Встреча', m_abs: 100 }]);
    expect(res.calendars).toHaveLength(1);
  });

  it('handles object-shaped global timeline and API failures gracefully', async () => {
    vi.mocked(api.getEntities).mockRejectedValue(new Error('fail'));
    vi.mocked(api.getGlobalTimeline).mockResolvedValueOnce({
      events: [{ id: 'ev:2', name: 'Битва', m_abs: 500 }],
    });

    const res = await fetchPromiseCardEntities('proj-1', calendarStore, arcsStore);
    expect(res.locations).toEqual([]);
    expect(res.characters).toEqual([]);
    expect(res.timelineEvents).toEqual([{ id: 'ev:2', title: 'Битва', m_abs: 500 }]);
  });
});
