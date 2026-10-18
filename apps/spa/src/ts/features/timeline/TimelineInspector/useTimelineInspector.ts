import { ref, computed, watch, onMounted } from 'vue';
import { getTimelineInspectorData } from '@/services/api.client';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import { useCalendarStore } from '@/stores/calendar.store';
import type {
  TimelineInspectorData,
  TimelineInspectorFilterState,
  InspectorEvent,
  InspectorChapter,
  InspectorReveal,
  VisualizedConnectionLine,
} from './TimelineInspector.model';

export function useTimelineInspector(projectId: string) {
  const calendarStore = useCalendarStore();
  const calendarData = ref<CalendarData | null>(null);
  const data = ref<TimelineInspectorData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const filters = ref<TimelineInspectorFilterState>({
    searchQuery: '',
    selectedEntityId: 'all',
    selectedPovId: 'all',
    readerHorizonChapterOrder: null, // null = full author view
    showFlashbacksOnly: false,
  });

  const loadInspectorData = async () => {
    if (!projectId) return;
    isLoading.value = true;
    error.value = null;
    try {
      const cals = await calendarStore.getCalendars(projectId);
      if (cals && cals.length > 0) {
        const master = cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_master) || cals.find((c: { is_master?: boolean; is_default?: boolean }) => c.is_default) || cals[0];
        calendarData.value = (master?.data as CalendarData) || null;
      }
      const raw = await getTimelineInspectorData(
        projectId,
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

  const filteredChapters = computed<InspectorChapter[]>(() => {
    if (!data.value) return [];
    let chs = [...data.value.chapters].sort((a, b) => a.sort_order - b.sort_order);
    if (filters.value.readerHorizonChapterOrder !== null) {
      chs = chs.filter((c) => c.sort_order <= (filters.value.readerHorizonChapterOrder ?? 999999));
    }
    return chs;
  });

  const filteredEvents = computed<InspectorEvent[]>(() => {
    if (!data.value) return [];
    const q = filters.value.searchQuery.toLowerCase().trim();

    return data.value.events
      .filter((ev: InspectorEvent) => {
        if (q && !ev.title.toLowerCase().includes(q) && !(ev.description || '').toLowerCase().includes(q)) {
          return false;
        }
        if (filters.value.selectedEntityId !== 'all') {
          const hasParticipant = ev.participants.some((p) => p.id === filters.value.selectedEntityId);
          if (!hasParticipant) return false;
        }
        if (filters.value.selectedPovId !== 'all') {
          const hasPov = ev.reveals.some((r) => r.pov_id === filters.value.selectedPovId);
          if (!hasPov) return false;
        }
        if (filters.value.showFlashbacksOnly) {
          const hasFlashback = ev.reveals.some((r) => r.kind === 'flashback');
          if (!hasFlashback) return false;
        }
        return true;
      })
      .sort((a, b) => a.m_abs - b.m_abs);
  });

  const getEventId = (ev: InspectorEvent): string => {
    return ev.event_id || ev.id || '';
  };

  const formattedEvents = computed(() => {
    const cal = calendarData.value;

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

      const cleanParticipants = (ev.participants || []).filter(
        (p) => p && p.name && p.name.trim().length > 0
      );

      return {
        ...ev,
        id: evId,
        formattedDate,
        cleanParticipants,
        isScene: evId.startsWith('plot_promises:') || !evId.startsWith('timeline_events:'),
      };
    });
  });

  const connectionLines = computed<VisualizedConnectionLine[]>(() => {
    const lines: VisualizedConnectionLine[] = [];
    const chs = filteredChapters.value;
    const evs = filteredEvents.value;

    if (!chs.length || !evs.length) return [];

    const chapterSpacing = 170;
    const eventSpacing = 190;
    const startX = 100;

    const chapterPositions = new Map<string, number>();
    chs.forEach((ch, idx) => {
      chapterPositions.set(ch.id, startX + idx * chapterSpacing);
    });

    const eventPositions = new Map<string, number>();
    evs.forEach((ev, idx) => {
      const evId = getEventId(ev) || `ev-${idx}`;
      eventPositions.set(evId, startX + idx * eventSpacing);
    });

    evs.forEach((ev) => {
      const evId = getEventId(ev);
      ev.reveals.forEach((r: InspectorReveal) => {
        const rChId = r.chapter_id.replace(/^chapters:/, '');
        const matchedChId = Array.from(chapterPositions.keys()).find(
          (k) => k.replace(/^chapters:/, '') === rChId
        );
        const x1 = matchedChId ? chapterPositions.get(matchedChId) : undefined;
        const x2 = eventPositions.get(evId);

        if (x1 !== undefined && x2 !== undefined) {
          const isFlashback = r.kind === 'flashback' || x1 < x2;
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
            y1: 105,
            x2,
            y2: 365,
          });
        }
      });
    });

    return lines;
  });

  const canvasMinWidth = computed(() => {
    const chWidth = 100 + filteredChapters.value.length * 170 + 150;
    const evWidth = 100 + filteredEvents.value.length * 190 + 150;
    return `${Math.max(1200, Math.max(chWidth, evWidth))}px`;
  });

  watch(() => [projectId, filters.value.readerHorizonChapterOrder], loadInspectorData);
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
    refresh: loadInspectorData,
  };
}
