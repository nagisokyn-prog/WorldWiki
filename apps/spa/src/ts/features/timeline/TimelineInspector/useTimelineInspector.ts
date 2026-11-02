import { ref, computed, watch, onMounted } from 'vue';
import { getTimelineInspectorData } from '@/services/api.client';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import { useCalendarStore } from '@/stores/calendar.store';
import {
  type TimelineInspectorData,
  type TimelineInspectorFilterState,
  type InspectorEvent,
  type InspectorChapter,
  type InspectorReveal,
  type VisualizedConnectionLine,
  type FormattedInspectorEvent,
  type TimelineInspectorProps,
  type TimelineInspectorEmits,
  type InspectorParticipant,
  getInspectorKindMeta,
} from './TimelineInspector.model';

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

  // Интерактивное состояние фокуса и навигации
  const activeChapterId = ref<string | null>(null);
  const hoveredChapterId = ref<string | null>(null);
  const hoveredEventId = ref<string | null>(null);
  const pingedEventId = ref<string | null>(null);

  const filters = ref<TimelineInspectorFilterState>({
    searchQuery: '',
    selectedEntityId: 'all',
    selectedPovId: 'all',
    readerHorizonChapterOrder: null, // null = full author view
    showFlashbacksOnly: false,
    linkMode: 'focus', // По умолчанию интерактивный фокус (Zero-Clutter)
    isolatedChapterId: null, // null = все сцены
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

  const getEventId = (ev: InspectorEvent): string => {
    return ev.event_id || ev.id || '';
  };

  const normalizeId = (id?: string | null): string => {
    if (!id) return '';
    return String(id).replace(/^(chapters|plot_promises|timeline_events|entities):/, '');
  };

  // Метод 1: Явный флаг флешбэка + дельта анахронизма
  const checkIsFlashback = (ev: InspectorEvent, allChs: InspectorChapter[]): boolean => {
    if (ev.reveals?.some((r) => r.kind === 'flashback' || (r as unknown as { time_nature?: string }).time_nature === 'flashback')) {
      return true;
    }
    const rawObj = ev as unknown as { time_nature?: string; is_flashback?: boolean };
    if (rawObj.time_nature === 'flashback' || rawObj.is_flashback === true) {
      return true;
    }
    const text = `${ev.title} ${ev.description || ''}`.toLowerCase();
    if (text.includes('флешбэк') || text.includes('флешбек') || text.includes('ретроспектив') || text.includes('воспоминани')) {
      return true;
    }

    // Хронологический анахронизм: если сцена привязана к поздней главе, но её дата меньше дат ранних глав
    const primaryRev = ev.reveals?.[0];
    if (primaryRev && ev.m_abs > 0 && allChs.length > 1) {
      const cleanChId = normalizeId(primaryRev.chapter_id);
      const chIdx = allChs.findIndex((c) => normalizeId(c.id) === cleanChId);
      if (chIdx > 0) {
        const prevChIds = new Set(allChs.slice(0, chIdx).map((c) => normalizeId(c.id)));
        const prevEvents = (data.value?.events || []).filter(
          (e) => e.m_abs > 0 && e.reveals?.some((r) => prevChIds.has(normalizeId(r.chapter_id)))
        );
        if (prevEvents.length > 0) {
          const maxPrevMabs = Math.max(...prevEvents.map((e) => e.m_abs));
          if (ev.m_abs < maxPrevMabs - 1440) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const filteredChapters = computed<InspectorChapter[]>(() => {
    if (!data.value) return [];
    let chs = [...data.value.chapters].sort((a, b) => a.sort_order - b.sort_order);
    if (filters.value.readerHorizonChapterOrder !== null) {
      chs = chs.filter((c, idx) => {
        const order = (c.sort_order && Number(c.sort_order) > 0) ? Number(c.sort_order) : (idx + 1);
        return order <= (filters.value.readerHorizonChapterOrder ?? 999999);
      });
    }

    const allEvents = data.value.events || [];

    return chs.map((ch, idx) => {
      const order = (ch.sort_order && Number(ch.sort_order) > 0) ? Number(ch.sort_order) : (idx + 1);
      const title = ch.title && ch.title.trim() ? ch.title.trim() : `Глава #${order}`;
      const cleanChId = normalizeId(ch.id);
      const chEvents = allEvents.filter((ev) =>
        ev.reveals?.some((r) => normalizeId(r.chapter_id) === cleanChId)
      );

      const sceneCount = chEvents.length;
      let flashbackCount = 0;
      let earliestFlashbackEventId: string | null = null;
      let minMabs = Infinity;

      chEvents.forEach((ev) => {
        if (checkIsFlashback(ev, chs)) {
          flashbackCount++;
          if (ev.m_abs < minMabs) {
            minMabs = ev.m_abs;
            earliestFlashbackEventId = getEventId(ev);
          }
        }
      });

      return {
        ...ch,
        title,
        sort_order: order,
        sceneCount,
        flashbackCount,
        earliestFlashbackEventId,
      };
    });
  });

  const filteredEvents = computed<InspectorEvent[]>(() => {
    if (!data.value) return [];
    const q = filters.value.searchQuery.toLowerCase().trim();
    const isolatedChId = filters.value.isolatedChapterId ? normalizeId(filters.value.isolatedChapterId) : null;
    const chaptersList = data.value.chapters || [];

    let evs = data.value.events.filter((ev: InspectorEvent) => {
      if (q && !ev.title.toLowerCase().includes(q) && !(ev.description || '').toLowerCase().includes(q)) {
        return false;
      }
      if (isolatedChId) {
        const belongsToIsolated = ev.reveals?.some((r) => normalizeId(r.chapter_id) === isolatedChId);
        if (!belongsToIsolated) return false;
      }
      if (filters.value.selectedEntityId !== 'all') {
        const target = normalizeId(filters.value.selectedEntityId);
        const hasParticipant = ev.participants.some((p: { id?: string } | string) => {
          const pid = typeof p === 'string' ? p : p?.id;
          return pid && normalizeId(pid) === target;
        });
        if (!hasParticipant) return false;
      }
      if (filters.value.selectedPovId !== 'all') {
        const hasPov = ev.reveals.some((r) => r.pov_id === filters.value.selectedPovId);
        if (!hasPov) return false;
      }
      if (filters.value.showFlashbacksOnly) {
        const isFb = checkIsFlashback(ev, chaptersList);
        if (!isFb) return false;
      }
      return true;
    });

    // Клиентская дедупликация: исключаем дубликаты событий мира, если есть сцена с тем же временем и текстом
    const sceneSignatures = new Set<string>();
    evs.forEach((ev) => {
      const isScene = getEventId(ev).startsWith('plot_promises:') || !getEventId(ev).startsWith('timeline_events:');
      if (isScene) {
        sceneSignatures.add(`${ev.m_abs}_${ev.title.trim().toLowerCase()}`);
      }
    });

    evs = evs.filter((ev) => {
      const isPureEvent = getEventId(ev).startsWith('timeline_events:') && ev.kind === 'event';
      if (isPureEvent) {
        const sig = `${ev.m_abs}_${ev.title.trim().toLowerCase()}`;
        if (sceneSignatures.has(sig)) {
          return false;
        }
      }
      return true;
    });

    return evs.sort((a, b) => a.m_abs - b.m_abs);
  });

  const formattedEvents = computed<FormattedInspectorEvent[]>(() => {
    const cal = calendarData.value;
    const chaptersList = filteredChapters.value;

    return filteredEvents.value.map((ev) => {
      const evId = getEventId(ev);
      let formattedDate = `M_abs: ${ev.m_abs}`;
      if (cal && ev.m_abs !== undefined && ev.m_abs !== null) {
        try {
          const dateInput = CalendarMath.getDateFromAbsolute(ev.m_abs, cal);
          const calDate: CalendarDate = {
            absolute_minute: ev.m_abs,
            calendar_id: (cal as unknown as { id?: string; _id?: string }).id || (cal as unknown as { id?: string; _id?: string })._id || 'default',
            original_input: dateInput,
          };
          formattedDate = CalendarFormat.formatDate(cal, calDate) || `M_abs: ${ev.m_abs}`;
        } catch {
          formattedDate = `M_abs: ${ev.m_abs}`;
        }
      }

      const cleanParticipants: InspectorParticipant[] = (ev.participants || [])
        .map((p: { id?: string; name?: string; entity_type?: string } | string) => {
          if (typeof p === 'string') {
            return { id: p, name: p.replace(/^entities:/, ''), entity_type: 'character' };
          }
          return {
            id: p.id || '',
            name: p.name || '',
            entity_type: p.entity_type || 'character',
          };
        })
        .filter((p: InspectorParticipant) => p && p.name && String(p.name).trim().length > 0);

      const kind = ev.kind || (evId.startsWith('timeline_events:') ? 'event' : 'scene');
      const kindMeta = getInspectorKindMeta(kind);
      const isFlashback = checkIsFlashback(ev, chaptersList);
      const primaryReveal = ev.reveals?.[0];

      return {
        ...ev,
        id: evId,
        formattedDate,
        cleanParticipants,
        isScene: evId.startsWith('plot_promises:') || !evId.startsWith('timeline_events:'),
        kind,
        kindMeta,
        isFlashback,
        primaryChapterId: primaryReveal?.chapter_id ? normalizeId(primaryReveal.chapter_id) : undefined,
        primaryChapterTitle: primaryReveal?.chapter_title || undefined,
      };
    });
  });

  const chapterSpacing = 140;
  const eventSpacing = 160;
  const startX = 60;

  const connectionLines = computed<VisualizedConnectionLine[]>(() => {
    if (filters.value.linkMode === 'none') return [];

    const lines: VisualizedConnectionLine[] = [];
    const chs = filteredChapters.value;
    const evs = filteredEvents.value;

    if (!chs.length || !evs.length) return [];

    const chapterPositions = new Map<string, number>();
    chs.forEach((ch, idx) => {
      chapterPositions.set(normalizeId(ch.id), startX + idx * chapterSpacing);
    });

    const eventPositions = new Map<string, number>();
    evs.forEach((ev, idx) => {
      const evId = getEventId(ev) || `ev-${idx}`;
      eventPositions.set(evId, startX + idx * eventSpacing);
    });

    const targetChId = activeChapterId.value ? normalizeId(activeChapterId.value) : (hoveredChapterId.value ? normalizeId(hoveredChapterId.value) : null);
    const targetEvId = hoveredEventId.value ? getEventId({ id: hoveredEventId.value, title: '', m_abs: 0, reveals: [], participants: [] }) : null;

    evs.forEach((ev) => {
      const evId = getEventId(ev);

      if (filters.value.linkMode === 'focus') {
        if (targetChId) {
          const belongsToTargetCh = ev.reveals.some((r) => normalizeId(r.chapter_id) === targetChId);
          if (!belongsToTargetCh) return;
        } else if (targetEvId) {
          if (evId !== targetEvId) return;
        } else {
          return;
        }
      }

      ev.reveals.forEach((r: InspectorReveal) => {
        const cleanRChId = normalizeId(r.chapter_id);
        if (targetChId && cleanRChId !== targetChId) return;

        const x1 = chapterPositions.get(cleanRChId);
        const x2 = eventPositions.get(evId);

        if (x1 !== undefined && x2 !== undefined) {
          const isFlashback = checkIsFlashback(ev, chs) || r.kind === 'flashback' || x1 > x2;
          lines.push({
            id: `line-${evId}-${r.chapter_id}`,
            eventId: evId,
            chapterId: r.chapter_id,
            eventTitle: ev.title,
            chapterTitle: r.chapter_title,
            chapterOrder: r.chapter_order ?? r.chapter_sort_order ?? 0,
            m_abs: ev.m_abs,
            kind: r.kind,
            isFlashback,
            x1,
            y1: 60,
            x2,
            y2: 170,
          });
        }
      });
    });

    return lines;
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
