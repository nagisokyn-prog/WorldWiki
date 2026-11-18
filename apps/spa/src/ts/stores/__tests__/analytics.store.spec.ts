import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAnalyticsStore } from '../analytics.store';

const mockGetCrossReferenceMatrix = vi.fn();
const mockGetManuscriptStatistics = vi.fn();
const mockGetItemTracker = vi.fn();
const mockGetItemJourney = vi.fn();

vi.mock('@/services/api.client', () => ({
  getCrossReferenceMatrix: (...args: unknown[]) => mockGetCrossReferenceMatrix(...args),
  getManuscriptStatistics: (...args: unknown[]) => mockGetManuscriptStatistics(...args),
  getItemTracker: (...args: unknown[]) => mockGetItemTracker(...args),
  getItemJourney: (...args: unknown[]) => mockGetItemJourney(...args)
}));

describe('analytics.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads matrix with cache, empty fallback, and error handling', async () => {
    const store = useAnalyticsStore();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sampleMatrix = { chapters: [{ id: 'c1', title: 'Ch1', sort_order: 1, word_count: 100 }], entities: [] };
    mockGetCrossReferenceMatrix.mockResolvedValueOnce(sampleMatrix);

    expect(await store.loadMatrix('proj-1')).toEqual(sampleMatrix);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();

    // Cached
    expect(await store.loadMatrix('proj-1')).toEqual(sampleMatrix);
    expect(mockGetCrossReferenceMatrix).toHaveBeenCalledTimes(1);

    // Force reload returning null -> fallback empty matrix
    mockGetCrossReferenceMatrix.mockResolvedValueOnce(null);
    expect(await store.loadMatrix('proj-1', true)).toEqual({ chapters: [], entities: [] });

    // Error path (Error + non-Error)
    mockGetCrossReferenceMatrix.mockRejectedValueOnce(new Error('Matrix fail'));
    expect(await store.loadMatrix('proj-2')).toBeNull();
    expect(store.error).toBe('Matrix fail');

    mockGetCrossReferenceMatrix.mockRejectedValueOnce('string err');
    expect(await store.loadMatrix('proj-3')).toBeNull();
    expect(store.error).toBe('string err');

    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('loads manuscript stats and handles errors', async () => {
    const store = useAnalyticsStore();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sampleStats = { total_words: 500, total_chapters: 2, total_entities: 5, pov_distribution: [], event_density: [], promise_stats: { planted: 1, developed: 0, resolved: 0 } };
    mockGetManuscriptStatistics.mockResolvedValueOnce(sampleStats);
    expect(await store.loadStats('proj-1')).toEqual(sampleStats);
    expect(store.stats).toEqual(sampleStats);

    mockGetManuscriptStatistics.mockResolvedValueOnce(null);
    expect(await store.loadStats('proj-1')).toBeNull();

    mockGetManuscriptStatistics.mockRejectedValueOnce(new Error('Stats fail'));
    expect(await store.loadStats('proj-1')).toBeNull();
    expect(store.stats).toBeNull();

    errSpy.mockRestore();
  });

  it('loads itemTracker with cache, force, error, loads itemJourney, and invalidates', async () => {
    const store = useAnalyticsStore();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tracker = { summary: { total_items: 1, active_count: 1, sleeping_count: 0, forgotten_count: 0, destroyed_count: 0 }, items: [] };
    mockGetItemTracker.mockResolvedValueOnce(tracker);

    expect(await store.loadItemTracker('proj-1')).toEqual(tracker);
    expect(store.itemTrackerLoading).toBe(false);

    // Cache hit
    expect(await store.loadItemTracker('proj-1')).toEqual(tracker);
    expect(mockGetItemTracker).toHaveBeenCalledTimes(1);

    // Force null fallback
    mockGetItemTracker.mockResolvedValueOnce(null);
    expect(await store.loadItemTracker('proj-1', true)).toBeNull();

    // Error
    mockGetItemTracker.mockRejectedValueOnce(new Error('Tracker err'));
    expect(await store.loadItemTracker('proj-2')).toBeNull();
    expect(store.itemTracker).toBeNull();
    expect(store.itemTrackerLoading).toBe(false);

    // loadItemJourney
    const journey = { item_id: 'i1', item_name: 'Меч', item_type: 'item', status_category: 'active', nodes: [] };
    mockGetItemJourney.mockResolvedValueOnce(journey);
    expect(await store.loadItemJourney('proj-1', 'i1')).toEqual(journey);

    mockGetItemJourney.mockResolvedValueOnce(null);
    expect(await store.loadItemJourney('proj-1', 'i1')).toBeNull();

    mockGetItemJourney.mockRejectedValueOnce(new Error('Journey err'));
    expect(await store.loadItemJourney('proj-1', 'i1')).toBeNull();

    // invalidate
    store.matrixData = { chapters: [], entities: [] };
    store.stats = { total_words: 1, total_chapters: 1, total_entities: 1, pov_distribution: [], event_density: [], promise_stats: { planted: 0, developed: 0, resolved: 0 } };
    store.itemTracker = tracker;
    store.invalidate();
    expect(store.matrixData).toBeNull();
    expect(store.stats).toBeNull();
    expect(store.itemTracker).toBeNull();

    errSpy.mockRestore();
  });
});
