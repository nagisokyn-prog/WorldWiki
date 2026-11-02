import { describe, it, expect, vi } from 'vitest';
import { useTimelineInspectorToolbar } from '../useTimelineInspectorToolbar';
import type { TimelineInspectorToolbarProps } from '../TimelineInspectorToolbar.model';

describe('useTimelineInspectorToolbar', () => {
  it('emits refresh event on click', () => {
    const emit = vi.fn();
    const props: TimelineInspectorToolbarProps = {
      filters: {
        searchQuery: '',
        selectedEntityId: 'all',
        selectedPovId: 'all',
        readerHorizonChapterOrder: null,
        showFlashbacksOnly: false,
        linkMode: 'focus',
        isolatedChapterId: null,
      },
      filteredEventsCount: 5,
      filteredChaptersCount: 2,
      filteredChapters: [],
      isLoading: false,
    };

    const { onRefresh } = useTimelineInspectorToolbar(props, emit as unknown as Parameters<typeof useTimelineInspectorToolbar>[1]);
    onRefresh();
    expect(emit).toHaveBeenCalledWith('refresh');
  });
});
