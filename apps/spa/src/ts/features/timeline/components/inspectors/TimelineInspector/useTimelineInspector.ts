import { ref, computed, watch, onMounted } from 'vue';
import * as apiClient from '@/services/api.client';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { GeographyEntityRecord } from '@/services/Geography/locationHierarchy';
import { useCalendarStore } from '@/stores/calendar.store';
import { useChapterStore } from '@/stores/chapter.store';
import {
  type TimelineInspectorData,
  type TimelineInspectorFilterState,
  type TimelineVolumeSegment,
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
import { useTimelineInspectorNavigation } from './useTimelineInspectorNavigation';

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

  const navigation = useTimelineInspectorNavigation(filteredChapters, formattedEvents, emit);

  const chapterSpacing = 140;
  const eventSpacing = 160;
  const startX = 60;

  const connectionLines = computed(() =>
    calculateConnectionLines({
      linkMode: filters.value.linkMode,
      chapters: filteredChapters.value,
      events: filteredEvents.value,
      activeChapterId: navigation.activeChapterId.value,
      hoveredChapterId: navigation.hoveredChapterId.value,
      hoveredEventId: navigation.hoveredEventId.value,
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
    activeChapterId: navigation.activeChapterId,
    hoveredChapterId: navigation.hoveredChapterId,
    hoveredEventId: navigation.hoveredEventId,
    pingedEventId: navigation.pingedEventId,
    refresh: loadInspectorData,
    navigateToChapter: navigation.navigateToChapter,
    navigateToScene: navigation.navigateToScene,
    selectChapter: navigation.selectChapter,
    jumpToFlashback: navigation.jumpToFlashback,
    scrollToEvent: navigation.scrollToEvent,
    scrollToChapter: navigation.scrollToChapter,
    isEventHighlighted: navigation.isEventHighlighted,
    isEventDimmed: navigation.isEventDimmed,
    normalizeId,
  };
}
