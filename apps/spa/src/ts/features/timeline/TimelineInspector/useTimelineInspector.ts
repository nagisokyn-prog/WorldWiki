import { ref, computed, watch, onMounted } from 'vue';
import { getTimelineInspectorData } from '@/services/api.client';
import type { CalendarData } from '@/services/Calendars/calendar.types';
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
  const chapterStore = useChapterStore();
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
    selectedVolumeId: 'all',
    readerHorizonChapterOrder: null,
    showFlashbacksOnly: false,
    linkMode: 'focus',
    isolatedChapterId: null,
  });

  const volumeOptions = computed(() => {
    const list: Array<{ id: string; title: string }> = [{ id: 'all', title: 'Все тома' }];
    const known = new Set<string>();

    (chapterStore.hierarchy?.volumes || []).forEach((v) => {
      const clean = normalizeId(v.id);
      if (clean && !known.has(clean)) {
        known.add(clean);
        list.push({ id: clean, title: v.title || `Том ${clean}` });
      }
    });

    const allChs = [
      ...(chapterStore.hierarchy?.chapters || chapterStore.chapters || []),
      ...(data.value?.chapters || []),
    ];
    allChs.forEach((c) => {
      const vId = normalizeId(c.volume_id);
      if (vId && !known.has(vId)) {
        known.add(vId);
        list.push({ id: vId, title: `Том ${vId}` });
      }
    });

    return list;
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
    const hierarchyChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
    const volMap = new Map<string, string>();
    const volOrderMap = new Map<string, number>();
    const volTitleMap = new Map<string, string>();

    (chapterStore.hierarchy?.volumes || []).forEach((v, vIdx) => {
      const cleanV = normalizeId(v.id);
      volOrderMap.set(cleanV, vIdx);
      if (v.title) volTitleMap.set(cleanV, v.title);
    });

    hierarchyChapters.forEach((hc) => {
      const cleanChId = normalizeId(hc.id);
      const cleanVolId = normalizeId(hc.volume_id);
      if (cleanChId && cleanVolId) {
        volMap.set(cleanChId, cleanVolId);
      }
    });

    let chList = (data.value.chapters || []).map((ch) => {
      const cleanChId = normalizeId(ch.id);
      const resolvedVol = normalizeId(ch.volume_id) || volMap.get(cleanChId) || '';
      const rawTitle = (ch as unknown as { volume_title?: string }).volume_title;
      const resolvedTitle = rawTitle || volTitleMap.get(resolvedVol) || (resolvedVol ? `Том ${resolvedVol}` : 'Основной том');
      return {
        ...ch,
        volume_id: resolvedVol,
        volume_title: resolvedTitle
      };
    });

    if (filters.value.selectedVolumeId && filters.value.selectedVolumeId !== 'all') {
      const cleanTarget = normalizeId(filters.value.selectedVolumeId);
      chList = chList.filter(c => normalizeId(c.volume_id) === cleanTarget);
    }

    chList.sort((a, b) => {
      const vA = volOrderMap.get(a.volume_id || '') ?? 0;
      const vB = volOrderMap.get(b.volume_id || '') ?? 0;
      if (vA !== vB) return vA - vB;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return buildFilteredChapters(
      chList,
      data.value.events || [],
      filters.value.readerHorizonChapterOrder
    );
  });

  const volumeSegments = computed<TimelineVolumeSegment[]>(() => {
    const chs = filteredChapters.value;
    if (!chs.length) return [];
    const volTitleMap = new Map<string, string>();
    (chapterStore.hierarchy?.volumes || []).forEach((v) => {
      volTitleMap.set(normalizeId(v.id), v.title || `Том ${normalizeId(v.id)}`);
    });

    const segments: TimelineVolumeSegment[] = [];
    let currentVolId: string | null = null;
    let currentSegment: TimelineVolumeSegment | null = null;

    chs.forEach((ch, idx) => {
      const vId = normalizeId(ch.volume_id) || 'default';
      const vTitle = (ch as unknown as { volume_title?: string }).volume_title || volTitleMap.get(vId) || (vId !== 'default' ? `Том ${vId}` : 'Основной том');

      if (vId !== currentVolId || !currentSegment) {
        currentVolId = vId;
        const c1 = 60 + idx * 140;
        currentSegment = {
          volumeId: vId,
          volumeTitle: vTitle,
          startIndex: idx,
          count: 1,
          leftPx: c1,
          widthPx: 110,
          boundaryLeftPx: idx > 0 ? Math.round(60 + (idx - 0.5) * 140) : undefined,
        };
        segments.push(currentSegment);
      } else {
        currentSegment.count++;
        const c1 = 60 + currentSegment.startIndex * 140;
        const c2 = 60 + (currentSegment.startIndex + currentSegment.count - 1) * 140;
        currentSegment.leftPx = Math.round((c1 + c2) / 2);
        currentSegment.widthPx = (currentSegment.count - 1) * 140 + 110;
      }
    });

    return segments;
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
