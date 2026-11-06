import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTimelineInspectorNavigation } from './useTimelineInspectorNavigation';
import type { InspectorChapter, FormattedInspectorEvent } from './TimelineInspector.model';

describe('useTimelineInspectorNavigation', () => {
  const dummyChapters = ref<InspectorChapter[]>([
    { id: 'ch:1', title: 'Chapter 1', sort_order: 1 },
    { id: 'ch:2', title: 'Chapter 2', sort_order: 2, earliestFlashbackEventId: 'ev:1' },
  ]);

  const dummyEvents = ref<FormattedInspectorEvent[]>([
    {
      id: 'ev:1',
      title: 'Event 1',
      m_abs: 100,
      reveals: [{ chapter_id: 'ch:1', chapter_title: 'Chapter 1' }],
    } as unknown as FormattedInspectorEvent,
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles chapter selection', () => {
    const nav = useTimelineInspectorNavigation(dummyChapters, dummyEvents);
    expect(nav.activeChapterId.value).toBeNull();

    nav.selectChapter(dummyChapters.value[0]);
    expect(nav.activeChapterId.value).toBe('1');

    nav.selectChapter(dummyChapters.value[0]);
    expect(nav.activeChapterId.value).toBeNull();
  });

  it('determines event highlighted and dimmed status', () => {
    const nav = useTimelineInspectorNavigation(dummyChapters, dummyEvents);
    nav.activeChapterId.value = '1';

    expect(nav.isEventHighlighted(dummyEvents.value[0])).toBe(true);
    expect(nav.isEventDimmed(dummyEvents.value[0])).toBe(false);

    nav.activeChapterId.value = '999';
    expect(nav.isEventHighlighted(dummyEvents.value[0])).toBe(false);
    expect(nav.isEventDimmed(dummyEvents.value[0])).toBe(true);
  });

  it('emits open-chapter on navigateToChapter', () => {
    const emit = vi.fn();
    const nav = useTimelineInspectorNavigation(dummyChapters, dummyEvents, emit as any);

    nav.navigateToChapter(dummyChapters.value[0]);
    expect(emit).toHaveBeenCalledWith('open-chapter', { id: '1', title: 'Chapter 1' });

    nav.navigateToChapter('ch:2');
    expect(emit).toHaveBeenCalledWith('open-chapter', { id: '2', title: 'Chapter 2' });
  });

  it('jumps to flashback event', () => {
    const nav = useTimelineInspectorNavigation(dummyChapters, dummyEvents);
    const stopPropagation = vi.fn();
    nav.jumpToFlashback(dummyChapters.value[1], { stopPropagation } as unknown as Event);

    expect(stopPropagation).toHaveBeenCalled();
    expect(nav.activeChapterId.value).toBe('2');
    expect(nav.pingedEventId.value).toBe('1');
  });
});

