import { ref, computed, watch, onMounted } from 'vue';
import { getTimelineInspectorData } from '@/services/api.client';
import type {
  TimelineInspectorData,
  TimelineInspectorFilterState,
  InspectorEvent,
  InspectorChapter,
  InspectorReveal,
  VisualizedConnectionLine,
} from './TimelineInspector.model';

export function useTimelineInspector(projectId: string) {
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
      const raw = await getTimelineInspectorData(
        projectId,
        filters.value.readerHorizonChapterOrder
      );
      data.value = (raw as TimelineInspectorData) || { events: [], chapters: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useTimelineInspector] Error loading timeline inspector data:', err);
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

  const connectionLines = computed<VisualizedConnectionLine[]>(() => {
    const lines: VisualizedConnectionLine[] = [];
    const chs = filteredChapters.value;
    const evs = filteredEvents.value;

    if (!chs.length || !evs.length) return [];

    // Calculate layout coordinates
    const chapterSpacing = 160;
    const eventSpacing = 180;
    const startX = 80;

    const chapterPositions = new Map<string, number>();
    chs.forEach((ch, idx) => {
      chapterPositions.set(ch.id, startX + idx * chapterSpacing);
    });

    const eventPositions = new Map<string, number>();
    evs.forEach((ev, idx) => {
      eventPositions.set(ev.id, startX + idx * eventSpacing);
    });

    evs.forEach((ev) => {
      ev.reveals.forEach((r: InspectorReveal) => {
        const x1 = chapterPositions.get(r.chapter_id);
        const x2 = eventPositions.get(ev.id);

        if (x1 !== undefined && x2 !== undefined) {
          const isFlashback = r.kind === 'flashback' || x1 < x2;
          lines.push({
            id: `line-${ev.id}-${r.chapter_id}`,
            eventId: ev.id,
            chapterId: r.chapter_id,
            eventTitle: ev.title,
            chapterTitle: r.chapter_title,
            chapterOrder: r.chapter_order,
            m_abs: ev.m_abs,
            kind: r.kind,
            isFlashback,
            x1,
            y1: 50,  // top narrative axis
            x2,
            y2: 250, // bottom diegetic axis
          });
        }
      });
    });

    return lines;
  });

  watch(() => [projectId, filters.value.readerHorizonChapterOrder], loadInspectorData);
  onMounted(loadInspectorData);

  return {
    filters,
    filteredChapters,
    filteredEvents,
    connectionLines,
    isLoading,
    error,
    refresh: loadInspectorData,
  };
}
