import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import {
  type InspectorEvent,
  type InspectorChapter,
  type InspectorReveal,
  type VisualizedConnectionLine,
  type InspectorParticipant,
  type FormattedInspectorEvent,
  type TimelineInspectorFilterState,
  getInspectorKindMeta
} from './TimelineInspector.model';

export function normalizeId(id?: string | null): string {
  if (!id) return '';
  return String(id).replace(/^(chapters|plot_promises|timeline_events|entities):/, '');
}

export function getEventId(ev: InspectorEvent): string {
  return ev.event_id || ev.id || '';
}

export function checkIsFlashback(
  ev: InspectorEvent,
  allChs: InspectorChapter[],
  allEvents?: InspectorEvent[]
): boolean {
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

  const primaryRev = ev.reveals?.[0];
  if (primaryRev && ev.m_abs > 0 && allChs.length > 1 && allEvents) {
    const cleanChId = normalizeId(primaryRev.chapter_id);
    const chIdx = allChs.findIndex((c) => normalizeId(c.id) === cleanChId);
    if (chIdx > 0) {
      const prevChIds = new Set(allChs.slice(0, chIdx).map((c) => normalizeId(c.id)));
      const prevEvents = allEvents.filter(
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
}

export function formatEventDate(mAbs: number, cal: CalendarData | null): string {
  if (!cal || mAbs === undefined || mAbs === null) {
    return `M_abs: ${mAbs}`;
  }
  try {
    const dateInput = CalendarMath.getDateFromAbsolute(mAbs, cal);
    const calDate: CalendarDate = {
      absolute_minute: mAbs,
      calendar_id: (cal as unknown as { id?: string; _id?: string }).id || (cal as unknown as { id?: string; _id?: string })._id || 'default',
      original_input: dateInput,
    };
    return CalendarFormat.formatDate(cal, calDate) || `M_abs: ${mAbs}`;
  } catch {
    return `M_abs: ${mAbs}`;
  }
}

export function cleanParticipantsList(rawParticipants?: Array<{ id?: string; name?: string; entity_type?: string } | string>): InspectorParticipant[] {
  if (!rawParticipants) return [];
  return rawParticipants
    .map((p) => {
      if (typeof p === 'string') {
        return { id: p, name: p.replace(/^entities:/, ''), entity_type: 'character' };
      }
      return {
        id: p.id || '',
        name: p.name || '',
        entity_type: p.entity_type || 'character',
      };
    })
    .filter((p) => Boolean(p && p.name && String(p.name).trim().length > 0));
}

export function buildFilteredChapters(
  rawChapters: InspectorChapter[],
  allEvents: InspectorEvent[],
  readerHorizonOrder: number | null
): InspectorChapter[] {
  let chs = [...rawChapters].sort((a, b) => a.sort_order - b.sort_order);
  if (readerHorizonOrder !== null) {
    chs = chs.filter((c, idx) => {
      const order = (c.sort_order && Number(c.sort_order) > 0) ? Number(c.sort_order) : (idx + 1);
      return order <= (readerHorizonOrder ?? 999999);
    });
  }

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
      if (checkIsFlashback(ev, chs, allEvents)) {
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
}

export function filterInspectorEvents(
  rawEvents: InspectorEvent[],
  chaptersList: InspectorChapter[],
  filters: TimelineInspectorFilterState
): InspectorEvent[] {
  const q = filters.searchQuery.toLowerCase().trim();
  const isolatedChId = filters.isolatedChapterId ? normalizeId(filters.isolatedChapterId) : null;

  let evs = rawEvents.filter((ev: InspectorEvent) => {
    if (q && !ev.title.toLowerCase().includes(q) && !(ev.description || '').toLowerCase().includes(q)) {
      return false;
    }
    if (isolatedChId) {
      const belongsToIsolated = ev.reveals?.some((r) => normalizeId(r.chapter_id) === isolatedChId);
      if (!belongsToIsolated) return false;
    }
    if (filters.selectedEntityId !== 'all') {
      const target = normalizeId(filters.selectedEntityId);
      const hasParticipant = ev.participants.some((p: { id?: string } | string) => {
        const pid = typeof p === 'string' ? p : p?.id;
        return pid && normalizeId(pid) === target;
      });
      if (!hasParticipant) return false;
    }
    if (filters.selectedPovId !== 'all') {
      const hasPov = ev.reveals.some((r) => r.pov_id === filters.selectedPovId);
      if (!hasPov) return false;
    }
    if (filters.showFlashbacksOnly) {
      const isFb = checkIsFlashback(ev, chaptersList, rawEvents);
      if (!isFb) return false;
    }
    return true;
  });

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
}

export function buildFormattedEvents(
  events: InspectorEvent[],
  chapters: InspectorChapter[],
  cal: CalendarData | null,
  rawAllEvents?: InspectorEvent[]
): FormattedInspectorEvent[] {
  return events.map((ev) => {
    const evId = getEventId(ev);
    const formattedDate = formatEventDate(ev.m_abs, cal);
    const cleanParticipants = cleanParticipantsList(ev.participants);
    const kind = ev.kind || (evId.startsWith('timeline_events:') ? 'event' : 'scene');
    const kindMeta = getInspectorKindMeta(kind);
    const isFlashback = checkIsFlashback(ev, chapters, rawAllEvents);
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
}

export function calculateConnectionLines(params: {
  linkMode: 'focus' | 'all' | 'none';
  chapters: InspectorChapter[];
  events: InspectorEvent[];
  activeChapterId: string | null;
  hoveredChapterId: string | null;
  hoveredEventId: string | null;
  startX?: number;
  chapterSpacing?: number;
  eventSpacing?: number;
}): VisualizedConnectionLine[] {
  const {
    linkMode,
    chapters,
    events,
    activeChapterId,
    hoveredChapterId,
    hoveredEventId,
    startX = 60,
    chapterSpacing = 140,
    eventSpacing = 160
  } = params;

  if (linkMode === 'none' || !chapters.length || !events.length) return [];

  const lines: VisualizedConnectionLine[] = [];
  const chapterPositions = new Map<string, number>();
  chapters.forEach((ch, idx) => {
    chapterPositions.set(normalizeId(ch.id), startX + idx * chapterSpacing);
  });

  const eventPositions = new Map<string, number>();
  events.forEach((ev, idx) => {
    const evId = getEventId(ev) || `ev-${idx}`;
    eventPositions.set(evId, startX + idx * eventSpacing);
  });

  const targetChId = activeChapterId ? normalizeId(activeChapterId) : (hoveredChapterId ? normalizeId(hoveredChapterId) : null);
  const targetEvId = hoveredEventId ? getEventId({ id: hoveredEventId, title: '', m_abs: 0, reveals: [], participants: [] }) : null;

  events.forEach((ev) => {
    const evId = getEventId(ev);

    if (linkMode === 'focus') {
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
        const isFlashback = checkIsFlashback(ev, chapters) || r.kind === 'flashback' || x1 > x2;
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
}
