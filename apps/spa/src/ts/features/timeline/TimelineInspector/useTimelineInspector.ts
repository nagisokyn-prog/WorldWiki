import { ref, computed, watch, onMounted } from 'vue';
import * as apiClient from '@/services/api.client';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { GeographyEntityRecord } from '@/services/Geography/locationHierarchy';
import { useCalendarStore } from '@/stores/calendar.store';
import { useChapterStore } from '@/stores/chapter.store';
import {
  type TimelineInspectorData,
  type TimelineInspectorFilterState,
  type InspectorChapter,
  type TimelineVolumeSegment,
  type FormattedInspectorEvent,
  type TimelineInspectorProps,
  type TimelineInspectorEmits,
} from './TimelineInspector.model';
import {
  normalizeId,
  buildFilteredChapters,
  filterInspectorEvents,
  buildFormattedEvents,
} from './timelineInspector.utils';
import {
  buildVolumeOptions,
  resolveChaptersWithVolumes,
  buildVolumeSegments,
  calculateConnectionLines,
} from './timelineInspectorVolume.utils';

export function useTimelineInspector(
  propsOrProjectId: TimelineInspectorProps | string,
  emit?: TimelineInspectorEmits
) {
  const getProjectId = () =>
    typeof propsOrProjectId === 'string'
      ? propsOrProjectId
      : propsOrProjectId.projectId || propsOrProjectId.project || '';

  const calendarStore = useCalendarStore();
  const chapterStore = useChapterStore();
  const calendarData = ref<CalendarData | null>(null);
  const allCalendars = ref<Map<string, CalendarData>>(new Map());
  const projectEntities = ref<GeographyEntityRecord[]>([]);
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
    selectedVolumeId: 'all',
    readerHorizonChapterOrder: null,
    showFlashbacksOnly: false,
    linkMode: 'focus',
    isolatedChapterId: null,
  });

  const volumeOptions = computed(() => {
    const allChs = [
      ...(chapterStore.hierarchy?.chapters || chapterStore.chapters || []),
      ...(data.value?.chapters || []),
    ];
    return buildVolumeOptions(chapterStore.hierarchy?.volumes || [], allChs);
  });

  const loadInspectorData = async () => {
    const proj = getProjectId();
    if (!proj) return;
    isLoading.value = true;
    error.value = null;
    try {
      if (!chapterStore.hierarchy?.volumes?.length) {
        await chapterStore.loadChapters(proj);
      }
      const cals = await calendarStore.getCalendars(proj);
      const calMap = new Map<string, CalendarData>();
      if (cals && cals.length > 0) {
        for (const c of cals) {
          const cData = (c.data as CalendarData) || (c as unknown as CalendarData);
          if (c.id) {
            calMap.set(c.id, cData);
            calMap.set(normalizeId(c.id), cData);
          }
          if (c.name) calMap.set(c.name.toLowerCase(), cData);
        }
        const master =
          cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_master) ||
          cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_default) ||
          cals[0];
        calendarData.value = (master?.data as CalendarData) || null;
      }
      allCalendars.value = calMap;
      if (typeof apiClient.getEntities === 'function') {
        const [locsRes, statesRes] = await Promise.allSettled([
          apiClient.getEntities(proj, 'location'),
          apiClient.getEntities(proj, 'state'),
        ]);
        const locs =
          locsRes.status === 'fulfilled' && Array.isArray(locsRes.value)
            ? (locsRes.value as unknown as GeographyEntityRecord[])
            : [];
        const states =
          statesRes.status === 'fulfilled' && Array.isArray(statesRes.value)
            ? (statesRes.value as unknown as GeographyEntityRecord[])
            : [];
        projectEntities.value = [...locs, ...states];
      }
      const raw = await apiClient.getTimelineInspectorData(proj, filters.value.readerHorizonChapterOrder);
      data.value = (raw as TimelineInspectorData) || { events: [], chapters: [] };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err);
      console.error('[useTimelineInspector ERROR] Error loading timeline inspector data:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const filteredChapters = computed(() => {
    if (!data.value) return [];
    const hierarchyChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
    const chList = resolveChaptersWithVolumes(
      data.value.chapters || [],
      hierarchyChapters,
      chapterStore.hierarchy?.volumes || [],
      filters.value.selectedVolumeId
    );
    return buildFilteredChapters(chList, data.value.events || [], filters.value.readerHorizonChapterOrder);
  });

  const volumeSegments = computed<TimelineVolumeSegment[]>(() =>
    buildVolumeSegments(filteredChapters.value, chapterStore.hierarchy?.volumes || [])
  );

  const filteredEvents = computed(() => {
    if (!data.value) return [];
    return filterInspectorEvents(data.value.events || [], data.value.chapters || [], filters.value);
  });

  const formattedEvents = computed(() =>
    buildFormattedEvents(
      filteredEvents.value,
      filteredChapters.value,
      calendarData.value,
      data.value?.events,
      projectEntities.value,
      allCalendars.value
    )
  );

  const chapterSpacing = 140;
  const eventSpacing = 160;
  const startX = 60;

  const connectionLines = computed(() =>
    calculateConnectionLines({
      linkMode: filters.value.linkMode,
      chapters: filteredChapters.value,
      events: filteredEvents.value,
      activeChapterId: activeChapterId.value,
      hoveredChapterId: hoveredChapterId.value,
      hoveredEventId: hoveredEventId.value,
      startX,
      chapterSpacing,
      eventSpacing,
    })
  );

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
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
    setTimeout(() => {
      if (pingedEventId.value === cleanId) pingedEventId.value = null;
    }, 2500);
  };

  const scrollToChapter = (chapterId: string) => {
    const cleanId = normalizeId(chapterId);
    setTimeout(() => {
      const el = document.querySelector(`[data-chapter-id="${cleanId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
      if (targetEv) scrollToEvent(targetEv.id);
    }
  };

  const jumpToFlashback = (ch: InspectorChapter, e?: Event) => {
    if (e) e.stopPropagation();
    if (ch.earliestFlashbackEventId) {
      activeChapterId.value = normalizeId(ch.id);
      scrollToEvent(ch.earliestFlashbackEventId);
    }
  };

  const getTargetChId = () =>
    activeChapterId.value
      ? normalizeId(activeChapterId.value)
      : hoveredChapterId.value
        ? normalizeId(hoveredChapterId.value)
        : null;

  const isEventHighlighted = (ev: FormattedInspectorEvent): boolean => {
    if (hoveredEventId.value && normalizeId(ev.id) === normalizeId(hoveredEventId.value)) return true;
    const targetChId = getTargetChId();
    return targetChId ? ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) || false : false;
  };

  const isEventDimmed = (ev: FormattedInspectorEvent): boolean => {
    const targetChId = getTargetChId();
    return targetChId ? !ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) : false;
  };

  const navigateToChapter = (chapterIdOrObj: string | InspectorChapter) => {
    const chId = typeof chapterIdOrObj === 'string' ? chapterIdOrObj : chapterIdOrObj.id;
    const cleanId = normalizeId(chId);
    const title =
      typeof chapterIdOrObj === 'string'
        ? filteredChapters.value.find((c) => normalizeId(c.id) === cleanId)?.title || `Глава ${cleanId}`
        : chapterIdOrObj.title;
    if (emit) emit('open-chapter', { id: cleanId, title });
  };

  const navigateToScene = (ev: FormattedInspectorEvent) => {
    const reveal = ev.reveals?.[0];
    if (!reveal?.chapter_id) return;
    const cleanChId = normalizeId(reveal.chapter_id);
    const title = reveal.chapter_title || `Глава ${cleanChId}`;
    if (emit) emit('open-chapter', { id: cleanChId, title });
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
    volumeOptions,
    volumeSegments,
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
