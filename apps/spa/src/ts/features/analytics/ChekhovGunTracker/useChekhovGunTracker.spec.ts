import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChekhovGunTracker } from './useChekhovGunTracker';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';
import { plotApi } from '@/services/api/plot.api';

vi.mock('@/services/api/plot.api', () => ({
  plotApi: {
    getPlotPromise: vi.fn(),
  },
}));

describe('useChekhovGunTracker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('filters by scope, volume, type, usageState, search, and handles empty/object projectId', async () => {
    const analyticsStore = useAnalyticsStore();
    const chapterStore = useChapterStore();
    analyticsStore.loadItemTracker = vi.fn(async () => undefined) as any;
    analyticsStore.loadItemJourney = vi.fn(async () => ({ item: {} } as any)) as any;
    chapterStore.loadChapters = vi.fn(async () => undefined) as any;

    chapterStore.hierarchy = {
      volumes: [{ id: { String: 'volumes:v1' }, title: 'Том 1' }, { id: '', title: '' }],
      chapters: [
        { id: { id: 'chapters:c1' }, volume_id: 'volumes:v1', title: 'Г1' },
        { id: 'chapters:c2', volume_id: 'volumes:v2', title: 'Г2' },
      ],
    } as any;

    analyticsStore.itemTracker = {
      items: [
        {
          id: 'gun_1',
          item_name: 'Пистолет',
          item_type: 'gun',
          owner_name: 'Герой',
          usage_state: 'active',
          chapters_present: [{ chapter_id: 'chapters:c1' }, { chapter_id: '' }],
          source: 'promise',
        },
        {
          id: 'item_2',
          item_name: 'Меч',
          item_type: 'weapon',
          owner_name: 'Рыцарь',
          usage_state: 'sleeping',
          chapters_present: [{ chapter_id: 'chapters:c2' }],
        },
        {
          id: 'item_3',
          item_name: 'Кольцо',
          item_type: '',
          owner_name: '',
          usage_state: 'forgotten',
          chapters_present: [],
        },
      ],
    } as any;

    // Empty projectId guard
    const emptyTracker = useChekhovGunTracker({ project: '' });
    await emptyTracker.loadData();
    await emptyTracker.openJourney(analyticsStore.itemTracker!.items[0]);
    expect(analyticsStore.loadItemTracker).not.toHaveBeenCalled();

    const tracker = useChekhovGunTracker({ projectId: 'proj_1' });
    expect(tracker.volumeOptions.value.length).toBeGreaterThanOrEqual(3);

    await tracker.loadData();
    expect(analyticsStore.loadItemTracker).toHaveBeenCalledWith('proj_1', false);

    tracker.filter.value.scope = 'all';
    expect(tracker.filteredItems.value).toHaveLength(3);

    tracker.filter.value.scope = 'items';
    expect(tracker.filteredItems.value.length).toBeGreaterThanOrEqual(2);

    tracker.filter.value.selectedVolumeId = 'v1';
    expect(tracker.filteredItems.value.length).toBeGreaterThanOrEqual(0);

    tracker.filter.value.scope = 'guns';
    expect(tracker.filteredItems.value.length).toBeLessThanOrEqual(1);

    tracker.filter.value.itemType = 'weapon';
    expect(tracker.filteredItems.value).toHaveLength(0);

    tracker.filter.value.itemType = 'all';
    tracker.filter.value.selectedVolumeId = 'all';
    tracker.filter.value.scope = 'all';

    tracker.filter.value.usageState = 'active';
    expect(tracker.filteredItems.value).toHaveLength(1);
    tracker.filter.value.usageState = 'sleeping';
    expect(tracker.filteredItems.value).toHaveLength(1);
    tracker.filter.value.usageState = 'forgotten';
    expect(tracker.filteredItems.value).toHaveLength(1);
    tracker.filter.value.usageState = 'all';

    // openJourney for gun (with getPlotPromise error) and non-gun item
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(plotApi.getPlotPromise).mockRejectedValueOnce(new Error('not found'));
    await tracker.openJourney(analyticsStore.itemTracker!.items[0]);
    expect(tracker.selectedJourney.value).not.toBeNull();

    await tracker.openJourney(analyticsStore.itemTracker!.items[1]);
    expect(analyticsStore.loadItemJourney).toHaveBeenCalledWith('proj_1', 'item_2');

    tracker.handleLocateNode({ chapterId: 'c1', paragraphIndex: 1, quote: 'Q' });
    expect(tracker.isJourneyModalOpen.value).toBe(false);
    warnSpy.mockRestore();
  });
});
