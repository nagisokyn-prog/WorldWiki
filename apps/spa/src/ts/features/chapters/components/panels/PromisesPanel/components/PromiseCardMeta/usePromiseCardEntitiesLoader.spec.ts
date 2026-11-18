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

  it('covers fallbacks for missing titles, rejected timeline/stores, and non-id characters', async () => {
    vi.mocked(api.getEntities)
      .mockResolvedValueOnce([{ id: '', name: 'NoId' }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: 'char:2', title: 'Титул' }, { name: 'NoIdChar' }] as never);

    vi.mocked(api.getGlobalTimeline).mockResolvedValueOnce([
      { id: 'chapters:5', timeline_events: [{ id: 'ev:5', name: 'Имя' }] },
      { timeline_events: [{ id: 'ev:6' }] },
    ]);

    const res = await fetchPromiseCardEntities('proj-1', calendarStore, arcsStore);
    expect(res.locations).toEqual([]);
    expect(res.characters).toEqual([{ id: 'char:2', name: 'Титул', type: 'character' }]);
    expect(res.timelineEvents).toEqual([
      { id: 'ev:5', title: '[Глава 5] Имя', m_abs: undefined },
      { id: 'ev:6', title: '[Глава] ev:6', m_abs: undefined },
    ]);

    vi.mocked(api.getEntities).mockResolvedValue([] as never);
    vi.mocked(api.getGlobalTimeline).mockRejectedValueOnce(new Error('tl err'));
    const failingCal = { getCalendars: vi.fn().mockRejectedValueOnce(new Error('cal err')) } as any;
    const failingArcs = { loadArcs: vi.fn().mockRejectedValueOnce(new Error('arc err')) } as any;

    const resErr = await fetchPromiseCardEntities('proj-1', failingCal, failingArcs);
    expect(resErr.timelineEvents).toEqual([]);
    expect(resErr.calendars).toEqual([]);
  });
});
