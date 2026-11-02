import { ref, computed, watch, onMounted } from 'vue';
import { getTimelineInspectorData } from '@/services/api.client';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import { useCalendarStore } from '@/stores/calendar.store';
import {
  type TimelineInspectorData,
  type TimelineInspectorFilterState,
  type InspectorChapter,
  type FormattedInspectorEvent,
  type TimelineInspectorProps,
  type TimelineInspectorEmits,
} from './TimelineInspector.model';
import {
  normalizeId,
  buildFilteredChapters,
  filterInspectorEvents,
  buildFormattedEvents,
  calculateConnectionLines
} from './timelineInspector.utils';

export function useTimelineInspector(
  propsOrProjectId: TimelineInspectorProps | string,
  emit?: TimelineInspectorEmits
) {
  const getProjectId = () =>
    typeof propsOrProjectId === 'string'
      ? propsOrProjectId
      : (propsOrProjectId.projectId || propsOrProjectId.project || '');

  const calendarStore = useCalendarStore();
  const calendarData = ref<CalendarData | null>(null);
  const data = ref<TimelineInspectorData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const activeChapterId = ref<string | null>(null);
  const hoveredChapterId = ref<string | null>(null);
  const hoveredEventId = ref<string | null>(null);
  const pingedEventId = ref<string | null>(null);

  const filters = ref<TimelineInspectorFilterState>({
    searchQuery: '',
    selectedEntityId: 'all',
    selectedPovId: 'all',
    readerHorizonChapterOrder: null,
    showFlashbacksOnly: false,
    linkMode: 'focus',
    isolatedChapterId: null,
  });

  const loadInspectorData = async () => {
    const proj = getProjectId();
    if (!proj) return;
    isLoading.value = true;
    error.value = null;
    try {
      const cals = await calendarStore.getCalendars(proj);
      if (cals && cals.length > 0) {
        const master = cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_master) || cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_default) || cals[0];
        calendarData.value = (master?.data as CalendarData) || null;
      }
      const raw = await getTimelineInspectorData(
        proj,
        filters.value.readerHorizonChapterOrder
      );
      data.value = (raw as TimelineInspectorData) || { events: [], chapters: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useTimelineInspector ERROR] Error loading timeline inspector data:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const filteredChapters = computed(() => {
    if (!data.value) return [];
    return buildFilteredChapters(
      data.value.chapters,
      data.value.events || [],
      filters.value.readerHorizonChapterOrder
    );
  });

  const filteredEvents = computed(() => {
    if (!data.value) return [];
    return filterInspectorEvents(
      data.value.events || [],
      data.value.chapters || [],
      filters.value
    );
  });

  const formattedEvents = computed(() => {
    return buildFormattedEvents(
      filteredEvents.value,
      filteredChapters.value,
      calendarData.value,
      data.value?.events
    );
  });

  const chapterSpacing = 140;
  const eventSpacing = 160;
  const startX = 60;

  const connectionLines = computed(() => {
    return calculateConnectionLines({
      linkMode: filters.value.linkMode,
      chapters: filteredChapters.value,
      events: filteredEvents.value,
      activeChapterId: activeChapterId.value,
      hoveredChapterId: hoveredChapterId.value,
      hoveredEventId: hoveredEventId.value,
      startX,
      chapterSpacing,
      eventSpacing
    });
  });

  const canvasMinWidth = computed(() => {
    const chWidth = startX + filteredChapters.value.length * chapterSpacing + 120;
    const evWidth = startX + filteredEvents.value.length * eventSpacing + 120;
    return `${Math.max(600, Math.max(chWidth, evWidth))}px`;
  });

  const scrollToEvent = (eventId: string) => {
    const cleanId = normalizeId(eventId);
    pingedEventId.value = cleanId;

    setTimeout(() => {
      const el = document.querySelector(`[data-event-id="${cleanId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 50);

    setTimeout(() => {
      if (pingedEventId.value === cleanId) {
        pingedEventId.value = null;
      }
    }, 2500);
  };

  const scrollToChapter = (chapterId: string) => {
    const cleanId = normalizeId(chapterId);
    setTimeout(() => {
      const el = document.querySelector(`[data-chapter-id="${cleanId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 50);
  };

  const selectChapter = (ch: InspectorChapter) => {
    const cleanId = normalizeId(ch.id);
    if (activeChapterId.value === cleanId) {
      activeChapterId.value = null;
    } else {
      activeChapterId.value = cleanId;
      const targetEv = formattedEvents.value.find((ev) =>
        ev.reveals?.some((r) => normalizeId(r.chapter_id) === cleanId)
      );
      if (targetEv) {
        scrollToEvent(targetEv.id);
      }
    }
  };

  const jumpToFlashback = (ch: InspectorChapter, e?: Event) => {
    if (e) e.stopPropagation();
    if (ch.earliestFlashbackEventId) {
      activeChapterId.value = normalizeId(ch.id);
      scrollToEvent(ch.earliestFlashbackEventId);
    }
  };

  const isEventHighlighted = (ev: FormattedInspectorEvent): boolean => {
    if (hoveredEventId.value && normalizeId(ev.id) === normalizeId(hoveredEventId.value)) return true;
    const targetChId = activeChapterId.value ? normalizeId(activeChapterId.value) : (hoveredChapterId.value ? normalizeId(hoveredChapterId.value) : null);
    if (!targetChId) return false;
    return ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) || false;
  };

  const isEventDimmed = (ev: FormattedInspectorEvent): boolean => {
    const targetChId = activeChapterId.value ? normalizeId(activeChapterId.value) : (hoveredChapterId.value ? normalizeId(hoveredChapterId.value) : null);
    if (!targetChId) return false;
    return !ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId);
  };

  const navigateToChapter = (chapterIdOrObj: string | InspectorChapter) => {
    const chId = typeof chapterIdOrObj === 'string'
      ? chapterIdOrObj
      : chapterIdOrObj.id;
    const cleanId = normalizeId(chId);
    const title = typeof chapterIdOrObj === 'string'
      ? (filteredChapters.value.find((c) => normalizeId(c.id) === cleanId)?.title || `Глава ${cleanId}`)
      : chapterIdOrObj.title;

    if (emit) {
      emit('open-chapter', { id: cleanId, title });
    }
  };

  const navigateToScene = (ev: FormattedInspectorEvent) => {
    const reveal = ev.reveals?.[0];
    if (!reveal?.chapter_id) return;
    const cleanChId = normalizeId(reveal.chapter_id);
    const title = reveal.chapter_title || `Глава ${cleanChId}`;

    if (emit) {
      emit('open-chapter', { id: cleanChId, title });
    }
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent('ww:locate-promise', {
          detail: {
            chapterId: cleanChId,
            paragraphIndex: 1,
            quote: ev.title,
            blockId: reveal.block_id || undefined,
          },
        })
      );
    }, 150);
  };

  watch(() => [getProjectId(), filters.value.readerHorizonChapterOrder], loadInspectorData);
  onMounted(loadInspectorData);

  return {
    filters,
    filteredChapters,
    filteredEvents,
    formattedEvents,
    connectionLines,
    canvasMinWidth,
    isLoading,
    error,
    activeChapterId,
    hoveredChapterId,
    hoveredEventId,
    pingedEventId,
    refresh: loadInspectorData,
    navigateToChapter,
    navigateToScene,
    selectChapter,
    jumpToFlashback,
    scrollToEvent,
    scrollToChapter,
    isEventHighlighted,
    isEventDimmed,
    normalizeId,
  };
}
